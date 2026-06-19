import { z } from 'zod'
import { env } from '@/config/env'
import { nextOccurrence } from '@/lib/time'
import { listNearby, type ChurchWithRelations } from '@/modules/church/repository'
import { massNowItemSchema, type massNowQuerySchema } from './schema'

type Item = z.infer<typeof massNowItemSchema>
type Schedule = ChurchWithRelations['massSchedules'][number]

const DAY_MS = 86_400_000

function freshnessOf(s: Schedule, now: Date) {
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

/**
 * "Missa Agora" (RF09): para cada igreja próxima, encontra horários cuja próxima
 * ocorrência cai dentro de [agora, agora+janela]. Ordena por horário e depois
 * por distância.
 */
export async function massNow(query: z.infer<typeof massNowQuerySchema>, now = new Date()): Promise<{
  data: Item[]
  meta: { window_min: number; total: number }
}> {
  const windowMs = query.window_min * 60_000
  const horizon = now.getTime() + windowMs

  const { rows, distances } = await listNearby({
    lat: query.lat,
    lng: query.lng,
    radiusM: query.radius_m,
    page: 1,
    pageSize: 500,
    maxScan: 500,
  })

  const items: Item[] = []
  for (const church of rows) {
    for (const s of church.massSchedules) {
      if (query.kind && s.kind !== query.kind) continue
      const at = nextOccurrence(s, now)
      if (!at) continue
      if (at.getTime() > horizon) continue
      items.push({
        churchId: church.id,
        publicSlug: church.publicSlug,
        churchName: church.name,
        type: church.type,
        lat: Number(church.lat),
        lng: Number(church.lng),
        city: church.city,
        distanceM: distances.get(church.id) ?? null,
        mass: {
          id: s.id,
          kind: s.kind,
          startTime: s.startTime,
          note: s.note,
          nextAt: at.toISOString(),
          minutesUntil: Math.round((at.getTime() - now.getTime()) / 60_000),
          freshness: freshnessOf(s, now),
        },
      })
    }
  }

  items.sort((a, b) => {
    const t = a.mass.nextAt.localeCompare(b.mass.nextAt)
    if (t !== 0) return t
    return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)
  })

  const limited = items.slice(0, query.limit)
  return { data: limited, meta: { window_min: query.window_min, total: items.length } }
}
