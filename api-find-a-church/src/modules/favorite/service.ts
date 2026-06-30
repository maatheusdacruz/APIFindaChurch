import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { nextOccurrence } from '@/lib/time'
import { env } from '@/config/env'
import { favoritesQuerySchema } from './schema'
import { churchSummarySchema } from '@/modules/church/schema'

const DAY_MS = 86_400_000

function freshnessOf(s: { lastConfirmedAt: Date | null; source: string; confidence: number }, now: Date) {
  const ageDays = s.lastConfirmedAt
    ? Math.floor((now.getTime() - s.lastConfirmedAt.getTime()) / DAY_MS)
    : null
  return {
    lastConfirmedAt: s.lastConfirmedAt ? s.lastConfirmedAt.toISOString() : null,
    source: s.source,
    confidence: s.confidence,
    ageDays,
    stale: ageDays === null ? true : ageDays > env.FRESHNESS_STALE_DAYS,
  }
}

export async function addFavorite(userId: number, churchId: number) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const existing = await prisma.favorite.findUnique({
    where: { userId_churchId: { userId, churchId } },
  })
  if (existing) {
    return { data: { churchId, createdAt: existing.createdAt.toISOString() }, isNew: false }
  }

  const fav = await prisma.favorite.create({ data: { userId, churchId } })
  return { data: { churchId, createdAt: fav.createdAt.toISOString() }, isNew: true }
}

export async function removeFavorite(userId: number, churchId: number) {
  await prisma.favorite.deleteMany({ where: { userId, churchId } })
}

export async function listFavorites(userId: number, query: z.infer<typeof favoritesQuerySchema>) {
  const now = new Date()
  const [favs, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      include: {
        church: {
          include: { massSchedules: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.favorite.count({ where: { userId } }),
  ])

  const data: z.infer<typeof churchSummarySchema>[] = favs.map((f) => {
    const c = f.church
    const masses = c.massSchedules
    let best: { schedule: typeof masses[0]; at: Date } | null = null
    for (const s of masses) {
      if (s.kind !== 'MISSA') continue
      const at = nextOccurrence(s, now)
      if (!at) continue
      if (!best || at.getTime() < best.at.getTime()) best = { schedule: s, at }
    }
    return {
      id: c.id,
      publicSlug: c.publicSlug,
      name: c.name,
      type: c.type,
      lat: Number(c.lat),
      lng: Number(c.lng),
      city: c.city,
      distanceM: null,
      nextMassAt: best ? best.at.toISOString() : null,
      freshness: best ? freshnessOf(best.schedule, now) : null,
      hasMassNow: false,
      hasSpecialEvent: false,
      isFavorite: true,
    }
  })

  return { data, meta: { page: query.page, pageSize: query.pageSize, total } }
}
