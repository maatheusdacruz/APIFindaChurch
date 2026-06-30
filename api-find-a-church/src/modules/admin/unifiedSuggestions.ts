import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/errors'

const MSS_STATUS_MAP: Record<string, UnifiedStatus> = {
  PENDENT: 'PENDING',
  REVISION: 'IN_REVIEW',
  APPLY: 'APPLIED',
  REJECTED: 'REJECTED',
}

const FIELD_LABELS: Record<string, string> = {
  NAME: 'Nome',
  ADDRESS: 'Endereço',
  PHONE: 'Telefone',
  WEBSITE: 'Site',
  COORDINATES: 'Localização',
  TYPE: 'Tipo',
  SCHEDULE: 'Horário',
  OTHER: 'Outro',
}

export type UnifiedType = 'INFO' | 'SCHEDULE' | 'GUARDIAN' | 'PARISH'
export type UnifiedStatus = 'PENDING' | 'IN_REVIEW' | 'APPLIED' | 'REJECTED'

export interface UnifiedSuggestion {
  _type: UnifiedType
  _id: number
  _status: UnifiedStatus
  _createdAt: string
  _churchId: number | null
  _churchName: string | null
  data: Record<string, unknown>
}

export async function listUnifiedSuggestions(
  statusFilter: 'PENDING' | 'IN_REVIEW' | 'APPLIED' | 'REJECTED' | 'ALL',
  typeFilter: UnifiedType | 'ALL',
): Promise<UnifiedSuggestion[]> {
  const results: UnifiedSuggestion[] = []

  // INFO suggestions
  if (typeFilter === 'ALL' || typeFilter === 'INFO') {
    const where = statusFilter !== 'ALL' ? { status: statusFilter as 'PENDING' | 'IN_REVIEW' | 'APPLIED' | 'REJECTED' } : {}
    const items = await prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const churchIds = [...new Set(items.filter(s => s.targetType === 'Church').map(s => s.targetId))]
    const churches = churchIds.length > 0
      ? await prisma.church.findMany({ where: { id: { in: churchIds } }, select: { id: true, name: true } })
      : []
    const churchMap = new Map(churches.map(c => [c.id, c.name]))
    for (const s of items) {
      results.push({
        _type: 'INFO',
        _id: s.id,
        _status: s.status as UnifiedStatus,
        _createdAt: s.createdAt.toISOString(),
        _churchId: s.targetType === 'Church' ? s.targetId : null,
        _churchName: s.targetType === 'Church' ? (churchMap.get(s.targetId) ?? null) : null,
        data: {
          field: s.field,
          fieldLabel: FIELD_LABELS[s.field] ?? s.field,
          currentValue: s.currentValue,
          proposedValue: s.proposedValue,
          notes: s.notes,
          riskTier: s.riskTier,
        },
      })
    }
  }

  // SCHEDULE suggestions
  if (typeFilter === 'ALL' || typeFilter === 'SCHEDULE') {
    const mssStatus = statusFilter === 'ALL' ? undefined
      : statusFilter === 'PENDING' ? 'PENDENT'
      : statusFilter === 'IN_REVIEW' ? 'REVISION'
      : statusFilter === 'APPLIED' ? 'APPLY'
      : 'REJECTED'
    const items = await prisma.massScheduleSuggestion.findMany({
      where: mssStatus ? { status: mssStatus as 'PENDENT' | 'REVISION' | 'APPLY' | 'REJECTED' } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        church: { select: { id: true, name: true } },
        suggestedBy: { select: { id: true, name: true } },
        targetSchedule: { select: { id: true, kind: true, dayOfWeek: true, startTime: true, note: true } },
      },
    })
    for (const s of items) {
      results.push({
        _type: 'SCHEDULE',
        _id: s.id,
        _status: MSS_STATUS_MAP[s.status] ?? 'PENDING',
        _createdAt: s.createdAt.toISOString(),
        _churchId: s.churchId,
        _churchName: s.church.name,
        data: {
          changeType: s.changeType,
          kind: s.kind,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          note: s.note,
          suggestedBy: s.suggestedBy?.name ?? null,
          currentSchedule: s.targetSchedule ? {
            kind: s.targetSchedule.kind,
            dayOfWeek: s.targetSchedule.dayOfWeek,
            startTime: s.targetSchedule.startTime,
            note: s.targetSchedule.note,
          } : null,
        },
      })
    }
  }

  // GUARDIAN requests — use raw SQL to avoid cached Prisma enum validation
  if (typeFilter === 'ALL' || typeFilter === 'GUARDIAN') {
    if (statusFilter === 'ALL' || statusFilter === 'PENDING') {
      type GRow = {
        id: number; churchId: number; userId: number; claimedAt: Date
        requestNotes: string | null
        church_name: string; user_name: string | null; user_email: string | null
      }
      const rows = await prisma.$queryRaw<GRow[]>`
        SELECT gr.id, gr."churchId", gr."userId", gr."claimedAt", gr."requestNotes",
               c.name AS church_name, u.name AS user_name, u.email AS user_email
        FROM "GuardianRole" gr
        JOIN "Church" c ON c.id = gr."churchId"
        JOIN "User"   u ON u.id = gr."userId"
        WHERE gr.status::text = 'PENDING'
        ORDER BY gr."claimedAt" DESC
        LIMIT 50
      `
      for (const g of rows) {
        results.push({
          _type: 'GUARDIAN',
          _id: g.id,
          _status: 'PENDING',
          _createdAt: g.claimedAt.toISOString(),
          _churchId: g.churchId,
          _churchName: g.church_name,
          data: {
            userId: g.userId,
            userName: g.user_name,
            userEmail: g.user_email,
            requestNotes: g.requestNotes,
          },
        })
      }
    }
  }

  // PARISH contested
  if (typeFilter === 'ALL' || typeFilter === 'PARISH') {
    if (statusFilter === 'ALL' || statusFilter === 'PENDING') {
      const items = await prisma.churchParish.findMany({
        where: { contested: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          church: { select: { id: true, name: true } },
          parish: { select: { id: true, name: true } },
        },
      })
      for (const cp of items) {
        results.push({
          _type: 'PARISH',
          _id: cp.churchId * 100000 + cp.parishId,
          _status: 'PENDING',
          _createdAt: cp.createdAt.toISOString(),
          _churchId: cp.churchId,
          _churchName: cp.church.name,
          data: {
            parishId: cp.parishId,
            parishName: cp.parish.name,
            churchId: cp.churchId,
          },
        })
      }
    }
  }

  results.sort((a, b) => new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime())
  return results
}

export async function approveGuardianRole(id: number): Promise<void> {
  const count = await prisma.$executeRaw`
    UPDATE "GuardianRole" SET status = 'ACTIVE'::"GuardianStatus" WHERE id = ${id} AND status::text = 'PENDING'
  `
  if (count === 0) throw new NotFoundError('Pedido de guardião não encontrado ou já processado.')
}

export async function rejectGuardianRole(id: number): Promise<void> {
  const count = await prisma.$executeRaw`
    UPDATE "GuardianRole" SET status = 'REMOVED'::"GuardianStatus" WHERE id = ${id} AND status::text = 'PENDING'
  `
  if (count === 0) throw new NotFoundError('Pedido de guardião não encontrado ou já processado.')
}

export async function resolveParishContest(churchId: number, parishId: number, approve: boolean): Promise<void> {
  if (approve) {
    await prisma.churchParish.update({
      where: { churchId_parishId: { churchId, parishId } },
      data: { contested: false },
    })
  } else {
    await prisma.churchParish.delete({
      where: { churchId_parishId: { churchId, parishId } },
    })
  }
}
