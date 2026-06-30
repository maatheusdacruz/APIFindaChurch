import { z } from 'zod'
import { env } from '@/config/env'
import { nextOccurrence } from '@/lib/time'
import { listNearby } from '@/modules/church/repository'
import { travelQuerySchema, travelDiscoverySchema } from './schema'
import { churchSummarySchema } from '@/modules/church/schema'
import type { ChurchWithRelations } from '@/modules/church/repository'

const DAY_MS = 86_400_000
const HIGHLIGHT_TYPES = new Set(['BASILICA', 'SANTUARIO', 'MOSTEIRO'])

function freshnessOf(s: ChurchWithRelations['massSchedules'][0], now: Date) {
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

function isMassNow(schedules: ChurchWithRelations['massSchedules'], now: Date): boolean {
  const lookback = new Date(now.getTime() - 60 * 60 * 1000)
  for (const s of schedules) {
    if (s.kind !== 'MISSA') continue
    const at = nextOccurrence(s, lookback)
    if (at && at.getTime() <= now.getTime()) return true
  }
  return false
}

function toSummary(c: ChurchWithRelations, distanceM: number | null, now: Date): z.infer<typeof churchSummarySchema> {
  let best: { schedule: ChurchWithRelations['massSchedules'][0]; at: Date } | null = null
  for (const s of c.massSchedules) {
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
    distanceM,
    nextMassAt: best ? best.at.toISOString() : null,
    freshness: best ? freshnessOf(best.schedule, now) : null,
    hasMassNow: isMassNow(c.massSchedules, now),
    hasSpecialEvent: false,
    isFavorite: false,
  }
}

export async function discoverTravel(query: z.infer<typeof travelQuerySchema>): Promise<{ data: z.infer<typeof travelDiscoverySchema> }> {
  const now = new Date()
  const { rows, distances } = await listNearby({
    lat: query.lat,
    lng: query.lng,
    radiusM: query.radius_m,
    page: 1,
    pageSize: 50,
    maxScan: 200,
  })

  const city = rows[0]?.city ?? null

  const highlights = rows
    .filter((c) => HIGHLIGHT_TYPES.has(c.type))
    .map((c) => toSummary(c, distances.get(c.id) ?? null, now))

  const nearby = rows
    .slice(0, 20)
    .map((c) => toSummary(c, distances.get(c.id) ?? null, now))

  return { data: { city, highlights, nearby } }
}
