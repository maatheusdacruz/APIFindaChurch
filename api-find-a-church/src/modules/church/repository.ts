import { Prisma, type ChurchType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findNearbyChurchIds } from '@/lib/geo'

/** Include padrão para montar resumo/perfil (atributos + horários). */
const withRelations = {
  attribute: true,
  massSchedules: { orderBy: { id: 'asc' } },
} satisfies Prisma.ChurchInclude

export type ChurchWithRelations = Prisma.ChurchGetPayload<{ include: typeof withRelations }>

export type ListFilters = {
  type?: string[]
  q?: string
  bbox?: string
  page: number
  pageSize: number
}

function bboxWhere(bbox?: string): Prisma.ChurchWhereInput {
  if (!bbox) return {}
  // Frontend envia minLng,minLat,maxLng,maxLat (ordem geográfica padrão).
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
  console.log('[bbox] parsed →', { minLng, minLat, maxLng, maxLat })
  return {
    lat: { gte: minLat, lte: maxLat },
    lng: { gte: minLng, lte: maxLng },
  }
}

export async function listChurches(f: ListFilters): Promise<{ rows: ChurchWithRelations[]; total: number }> {
  const where: Prisma.ChurchWhereInput = {
    ...(f.type && f.type.length ? { type: { in: f.type as ChurchType[] } } : {}),
    ...(f.q ? { name: { contains: f.q, mode: 'insensitive' } } : {}),
    ...bboxWhere(f.bbox),
  }

  console.log('[listChurches] where =', JSON.stringify(where))
  const [rows, total] = await Promise.all([
    prisma.church.findMany({
      where,
      include: withRelations,
      orderBy: { name: 'asc' },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    prisma.church.count({ where }),
  ])
  console.log(`[listChurches] total=${total} retornados=${rows.length}`)
  return { rows, total }
}

export async function getChurchById(id: number): Promise<ChurchWithRelations | null> {
  return prisma.church.findUnique({ where: { id }, include: withRelations })
}

export async function getUpcomingEvents(churchId: number, from: Date, page: number, pageSize: number) {
  const where: Prisma.EventWhereInput = { churchId, startsAt: { gte: from } }
  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ])
  return { rows, total }
}

export type NearResult = { rows: ChurchWithRelations[]; distances: Map<number, number>; total: number }

/**
 * Igrejas próximas ordenadas por distância (PostGIS faz o ranqueamento).
 * Paginamos por distância crescente: pegamos um teto e fatiamos.
 */
export async function listNearby(params: {
  lat: number
  lng: number
  radiusM: number
  types?: string[]
  page: number
  pageSize: number
  maxScan?: number
}): Promise<NearResult> {
  const maxScan = params.maxScan ?? 500
  const near = await findNearbyChurchIds({
    lat: params.lat,
    lng: params.lng,
    radiusM: params.radiusM,
    limit: maxScan,
    types: params.types,
  })
  const total = near.length
  const slice = near.slice((params.page - 1) * params.pageSize, params.page * params.pageSize)
  const distances = new Map(near.map((r) => [r.id, Number(r.distance_m)]))

  if (slice.length === 0) return { rows: [], distances, total }

  const found = await prisma.church.findMany({
    where: { id: { in: slice.map((r) => r.id) } },
    include: withRelations,
  })
  // Preserva a ordem por distância vinda do PostGIS.
  const byId = new Map(found.map((c) => [c.id, c]))
  const rows = slice.map((r) => byId.get(r.id)).filter((c): c is ChurchWithRelations => Boolean(c))
  return { rows, distances, total }
}
