import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { env } from '@/config/env'
import type { ChurchType } from '@prisma/client'

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const [users, churches, activeGuardians, pendingReports, pendingSuggestions] =
    await Promise.all([
      prisma.user.count(),
      prisma.church.count(),
      prisma.guardianRole.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count(),
      prisma.suggestion.count({ where: { status: 'PENDING' } }),
    ])

  return { data: { users, churches, activeGuardians, pendingReports, pendingSuggestions } }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listAdminUsers(page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        deviceId: true,
        isPlatformAdmin: true,
        reputation: true,
        createdAt: true,
        _count: { select: { guardianRoles: true, adminRoles: true } },
      },
    }),
    prisma.user.count(),
  ])

  return {
    data: items.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    meta: { page, pageSize, total },
  }
}

export async function setUserPlatformAdmin(userId: number, isPlatformAdmin: boolean) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isPlatformAdmin },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  })
  return { data: user }
}

export async function editUser(userId: number, body: { name?: string; email?: string }) {
  const exists = await prisma.user.findUnique({ where: { id: userId } })
  if (!exists) throw new NotFoundError(`Usuário ${userId} não encontrado.`)

  if (body.email && body.email !== exists.email) {
    const conflict = await prisma.user.findUnique({ where: { email: body.email } })
    if (conflict) throw new ConflictError('E-mail já está em uso por outro usuário.')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: body.name, email: body.email },
    select: {
      id: true, name: true, email: true, deviceId: true,
      isPlatformAdmin: true, reputation: true, createdAt: true,
      _count: { select: { guardianRoles: true, adminRoles: true } },
    },
  })
  return { data: { ...user, createdAt: user.createdAt.toISOString() } }
}

export async function deleteUser(userId: number) {
  const exists = await prisma.user.findUnique({ where: { id: userId } })
  if (!exists) throw new NotFoundError(`Usuário ${userId} não encontrado.`)
  await prisma.user.delete({ where: { id: userId } })
  return { data: { id: userId, deleted: true } }
}

// ─── Guardians ────────────────────────────────────────────────────────────────

export async function listAdminGuardians(status?: string) {
  const where = status ? { status: status as 'ACTIVE' | 'FROZEN' | 'REMOVED' } : undefined

  const items = await prisma.guardianRole.findMany({
    where,
    orderBy: { claimedAt: 'desc' },
    take: 100,
    include: {
      church: { select: { id: true, name: true, type: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return {
    data: items.map((g) => ({
      id: g.id,
      userId: g.userId,
      churchId: g.churchId,
      status: g.status,
      behavioralScore: g.behavioralScore,
      claimedAt: g.claimedAt.toISOString(),
      church: g.church,
      user: g.user,
    })),
  }
}

export async function updateGuardianStatus(guardianId: number, status: 'ACTIVE' | 'FROZEN' | 'REMOVED') {
  const guardian = await prisma.guardianRole.findUnique({ where: { id: guardianId } })
  if (!guardian) throw new NotFoundError(`Guardião ${guardianId} não encontrado.`)

  const updated = await prisma.guardianRole.update({
    where: { id: guardianId },
    data: { status },
    select: { id: true, status: true, userId: true, churchId: true },
  })
  return { data: updated }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function listAdminReports(page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.report.count(),
  ])

  return {
    data: items.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    meta: { page, pageSize, total },
  }
}

export async function dismissReport(reportId: number) {
  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) throw new NotFoundError(`Relatório ${reportId} não encontrado.`)

  await prisma.report.delete({ where: { id: reportId } })
  return { data: { id: reportId, dismissed: true } }
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

// Maps the user-facing SuggestionField enum → actual Prisma Church field names.
// Fields not listed here (OTHER, SCHEDULE) are informational-only — mark APPLIED
// but don't touch the church record.
const CHURCH_FIELD_MAP: Record<string, string> = {
  NAME: 'name',
  PHONE: 'phone',
  ADDRESS: 'addressLine',
  TYPE: 'type',
}

// COORDINATES is "lat, lng" — needs special parsing.
function applyCoordinates(proposedValue: string): { lat?: number; lng?: number } {
  const parts = proposedValue.split(',').map((s) => parseFloat(s.trim()))
  const [lat, lng] = parts
  const result: { lat?: number; lng?: number } = {}
  if (!isNaN(lat)) result.lat = lat
  if (!isNaN(lng)) result.lng = lng
  return result
}

export async function listAdminSuggestions(status: string) {
  const items = await prisma.suggestion.findMany({
    where: { status: status as 'PENDING' | 'APPLIED' | 'REJECTED' | 'IN_REVIEW' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  // Enrich with church name (batch-fetch to avoid N+1)
  const churchIds = [...new Set(
    items.filter((s) => s.targetType === 'Church').map((s) => s.targetId),
  )]
  const churches = await prisma.church.findMany({
    where: { id: { in: churchIds } },
    select: { id: true, name: true },
  })
  const churchMap = new Map(churches.map((c) => [c.id, c.name]))

  return {
    data: items.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      churchName: s.targetType === 'Church' ? (churchMap.get(s.targetId) ?? null) : null,
    })),
  }
}

export async function approveSuggestion(suggestionId: number) {
  const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } })
  if (!suggestion) throw new NotFoundError(`Sugestão ${suggestionId} não encontrada.`)

  const updated = await prisma.suggestion.update({
    where: { id: suggestionId },
    data: { status: 'APPLIED' },
    select: { id: true, status: true, field: true, proposedValue: true, targetType: true, targetId: true },
  })

  if (updated.targetType === 'Church') {
    const prismaField = CHURCH_FIELD_MAP[updated.field]
    if (prismaField) {
      await prisma.church.update({
        where: { id: updated.targetId },
        data: { [prismaField]: updated.proposedValue },
      })
    } else if (updated.field === 'COORDINATES') {
      const coords = applyCoordinates(updated.proposedValue)
      if (Object.keys(coords).length > 0) {
        await prisma.church.update({
          where: { id: updated.targetId },
          data: coords,
        })
      }
    }
    // OTHER / SCHEDULE / WEBSITE → informational only, no DB change
  }

  return { data: updated }
}

export async function rejectSuggestion(suggestionId: number) {
  const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } })
  if (!suggestion) throw new NotFoundError(`Sugestão ${suggestionId} não encontrada.`)

  const updated = await prisma.suggestion.update({
    where: { id: suggestionId },
    data: { status: 'REJECTED' },
    select: { id: true, status: true },
  })
  return { data: updated }
}

// ─── OSM Import ───────────────────────────────────────────────────────────────

const STATE_ABBR: Record<string, string> = {
  Acre: 'AC', Alagoas: 'AL', Amapá: 'AP', Amazonas: 'AM',
  Bahia: 'BA', Ceará: 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  Goiás: 'GO', Maranhão: 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', Pará: 'PA', Paraíba: 'PB', Paraná: 'PR',
  Pernambuco: 'PE', Piauí: 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', Rondônia: 'RO', Roraima: 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', Sergipe: 'SE', Tocantins: 'TO',
}

function toStateAbbr(s: string | null | undefined) {
  if (!s) return null
  return STATE_ABBR[s] ?? (s.length === 2 ? s.toUpperCase() : null)
}

const KIND_MAP: Record<string, ChurchType> = {
  chapel: 'CAPELA', basilica: 'BASILICA', monastery: 'MOSTEIRO',
  sanctuary: 'SANTUARIO', seminary: 'SEMINARIO',
}

function detectType(name: string, kind?: string): ChurchType {
  if (kind && KIND_MAP[kind.toLowerCase()]) return KIND_MAP[kind.toLowerCase()]
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/basilica/.test(n)) return 'BASILICA'
  if (/santuario|sanctuary/.test(n)) return 'SANTUARIO'
  if (/mosteiro|monastery|abadia/.test(n)) return 'MOSTEIRO'
  if (/seminario|seminary/.test(n)) return 'SEMINARIO'
  if (/capela|chapel/.test(n)) return 'CAPELA'
  return 'IGREJA'
}

export interface OsmRecord {
  osm_id: number | string
  osm_type?: string
  name: string
  kind?: string
  denomination?: string
  latitude: number
  longitude: number
  address?: string
  city?: string
  state?: string
  photo_url?: string | null
  tags?: Record<string, string>
}

export async function importOsmJson(records: OsmRecord[], batchSize = 100) {
  let created = 0, updated = 0, skipped = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (r) => {
        if (!r.name || r.latitude == null || r.longitude == null) { skipped++; return }
        const tags = r.tags ?? {}
        const slug = `osm-${r.osm_id}`
        const data = {
          publicSlug: slug,
          name: r.name,
          type: detectType(r.name, r.kind),
          lat: r.latitude,
          lng: r.longitude,
          city: r.city || tags['addr:city'] || null,
          state: toStateAbbr(r.state || tags['addr:state'] || null),
          district: tags['addr:suburb'] || tags['addr:neighbourhood'] || null,
          addressLine: tags['addr:street']
            ? `${tags['addr:street']}${tags['addr:housenumber'] ? ', ' + tags['addr:housenumber'] : ''}`
            : (r.address || null),
          postalCode: tags['addr:postcode'] || null,
          phone: tags['phone'] || tags['contact:phone'] || null,
          photoUrl: r.photo_url || null,
        }
        const existed = await prisma.church.findUnique({ where: { publicSlug: slug } })
        await prisma.church.upsert({
          where: { publicSlug: slug },
          create: {
            ...data,
            attribute: {
              create: {
                acessibilidade: Boolean(tags['wheelchair'] && tags['wheelchair'] !== 'no'),
                estacionamento: Boolean(tags['parking']),
                confissao: false, adoracao: false, livraria: false,
                grupoJovens: false, catequese: false,
              },
            },
          },
          update: data,
        })
        existed ? updated++ : created++
      }),
    )
  }

  return { data: { created, updated, skipped, total: records.length } }
}

// ─── Parishes ─────────────────────────────────────────────────────────────────

export async function listAdminParishes() {
  const items = await prisma.parish.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { churches: true, adminRoles: true } },
    },
  })

  return {
    data: items.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      churchCount: p._count.churches,
      adminCount: p._count.adminRoles,
    })),
  }
}
