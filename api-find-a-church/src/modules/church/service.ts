import { z } from 'zod'
import { env } from '@/config/env'
import { nextOccurrence } from '@/lib/time'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { ChurchType } from '@prisma/client'
import {
  listChurches,
  getChurchById,
  getUpcomingEvents,
  listNearby,
  type ChurchWithRelations,
} from './repository'
import {
  churchSummarySchema,
  churchProfileSchema,
  massScheduleSchema,
  freshnessSchema,
  eventSchema,
  type listQuerySchema,
  type nearQuerySchema,
  type profileQuerySchema,
} from './schema'

type Schedule = ChurchWithRelations['massSchedules'][number]
type Freshness = z.infer<typeof freshnessSchema>

const DAY_MS = 86_400_000

function isMassHappeningNow(schedules: Schedule[], now: Date): boolean {
  const lookback = new Date(now.getTime() - 60 * 60 * 1000)
  for (const s of schedules) {
    if (s.kind !== 'MISSA') continue
    const at = nextOccurrence(s, lookback)
    if (at && at.getTime() <= now.getTime()) return true
  }
  return false
}

/** Frescor de um horário (§3.7): nunca apagamos por estar velho, só sinalizamos. */
function freshnessOf(s: Schedule, now: Date): Freshness {
  const ageDays = s.lastConfirmedAt
    ? Math.floor((now.getTime() - s.lastConfirmedAt.getTime()) / DAY_MS)
    : null
  const stale = ageDays === null ? true : ageDays > env.FRESHNESS_STALE_DAYS
  return {
    lastConfirmedAt: s.lastConfirmedAt ? s.lastConfirmedAt.toISOString() : null,
    source: s.source,
    confidence: s.confidence,
    ageDays,
    stale,
  }
}

/** Próxima ocorrência mais cedo entre os horários (opcionalmente filtrando o tipo). */
function earliestNext(schedules: Schedule[], now: Date, kind?: Schedule['kind']) {
  let best: { schedule: Schedule; at: Date } | null = null
  for (const s of schedules) {
    if (kind && s.kind !== kind) continue
    const at = nextOccurrence(s, now)
    if (!at) continue
    if (!best || at.getTime() < best.at.getTime()) best = { schedule: s, at }
  }
  return best
}

function toSummary(c: ChurchWithRelations, now: Date, distanceM: number | null): z.infer<typeof churchSummarySchema> {
  const next = earliestNext(c.massSchedules, now, 'MISSA') ?? earliestNext(c.massSchedules, now)
  return {
    id: c.id,
    publicSlug: c.publicSlug,
    name: c.name,
    type: c.type,
    lat: Number(c.lat),
    lng: Number(c.lng),
    city: c.city,
    distanceM,
    nextMassAt: next ? next.at.toISOString() : null,
    freshness: next ? freshnessOf(next.schedule, now) : null,
    hasMassNow: isMassHappeningNow(c.massSchedules, now),
    hasSpecialEvent: false,
    isFavorite: false,
  }
}

function scheduleDto(s: Schedule, now: Date): z.infer<typeof massScheduleSchema> {
  const at = nextOccurrence(s, now)
  return {
    id: s.id,
    kind: s.kind,
    dayOfWeek: s.dayOfWeek,
    date: s.date ? s.date.toISOString().slice(0, 10) : null,
    startTime: s.startTime,
    note: s.note,
    nextAt: at ? at.toISOString() : null,
    freshness: freshnessOf(s, now),
  }
}

function toProfile(c: ChurchWithRelations, now: Date, distanceM: number | null): z.infer<typeof churchProfileSchema> {
  const next = earliestNext(c.massSchedules, now, 'MISSA') ?? earliestNext(c.massSchedules, now)
  return {
    id: c.id,
    publicSlug: c.publicSlug,
    name: c.name,
    type: c.type,
    lat: Number(c.lat),
    lng: Number(c.lng),
    address: {
      line: c.addressLine,
      district: c.district,
      city: c.city,
      state: c.state,
      postalCode: c.postalCode,
    },
    phone: c.phone,
    photoUrl: c.photoUrl,
    distanceM,
    attributes: {
      acessibilidade: c.attribute?.acessibilidade ?? false,
      estacionamento: c.attribute?.estacionamento ?? false,
      livraria: c.attribute?.livraria ?? false,
      adoracao: c.attribute?.adoracao ?? false,
      confissao: c.attribute?.confissao ?? false,
      grupoJovens: c.attribute?.grupoJovens ?? false,
      catequese: c.attribute?.catequese ?? false,
    },
    schedules: c.massSchedules.map((s) => scheduleDto(s, now)),
    freshness: next ? freshnessOf(next.schedule, now) : null,
    hasMassNow: isMassHappeningNow(c.massSchedules, now),
    isFavorite: false,
  }
}

// ───────────────────────────── Casos de uso ─────────────────────────────

export async function searchChurches(query: z.infer<typeof listQuerySchema>, now = new Date()) {
  const { rows, total } = await listChurches(query)
  return {
    data: rows.map((c) => toSummary(c, now, null)),
    meta: { page: query.page, pageSize: query.pageSize, total },
  }
}

export async function searchNearby(query: z.infer<typeof nearQuerySchema>, now = new Date()) {
  const { rows, distances, total } = await listNearby({
    lat: query.lat,
    lng: query.lng,
    radiusM: query.radius_m,
    types: undefined,
    page: query.page,
    pageSize: query.pageSize,
  })
  // Filtro por tipo de horário (kind) é pós-consulta: só igrejas com aquele horário.
  const filtered = query.kind
    ? rows.filter((c) => c.massSchedules.some((s) => s.kind === query.kind))
    : rows
  return {
    data: filtered.map((c) => toSummary(c, now, distances.get(c.id) ?? null)),
    meta: { page: query.page, pageSize: query.pageSize, total },
  }
}

export async function getProfile(id: number, geo: z.infer<typeof profileQuerySchema>, now = new Date()) {
  const church = await getChurchById(id)
  if (!church) throw new NotFoundError(`Igreja ${id} não encontrada.`)
  let distanceM: number | null = null
  if (geo.lat !== undefined && geo.lng !== undefined) {
    // Distância euclidiana via PostGIS seria ideal; aqui basta o haversine simples
    // sobre lat/lng já carregados para não fazer outra ida ao banco.
    distanceM = haversineM(geo.lat, geo.lng, Number(church.lat), Number(church.lng))
  }
  return { data: toProfile(church, now, distanceM) }
}

export async function getEvents(id: number, page: number, pageSize: number, now = new Date()) {
  const church = await getChurchById(id)
  if (!church) throw new NotFoundError(`Igreja ${id} não encontrada.`)
  const { rows, total } = await getUpcomingEvents(id, now, page, pageSize)
  const data: z.infer<typeof eventSchema>[] = rows.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
  }))
  return { data, meta: { page, pageSize, total } }
}

// ─── Criação manual ───────────────────────────────────────────────────────────

interface CreateChurchInput {
  name: string
  type?: ChurchType
  lat: number
  lng: number
  addressLine?: string
  district?: string
  city?: string
  state?: string
  postalCode?: string
  phone?: string
  photoUrl?: string
}

export async function createChurch(input: CreateChurchInput, userId: number) {
  const slug = `user-${userId}-${Date.now()}`
  const church = await prisma.church.create({
    data: {
      publicSlug: slug,
      name: input.name,
      type: (input.type as ChurchType) ?? 'IGREJA',
      lat: input.lat,
      lng: input.lng,
      addressLine: input.addressLine ?? null,
      district: input.district ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      phone: input.phone ?? null,
      photoUrl: input.photoUrl ?? null,
      attribute: {
        create: {
          acessibilidade: false, estacionamento: false,
          confissao: false, adoracao: false, livraria: false,
          grupoJovens: false, catequese: false,
        },
      },
    },
    select: { id: true, publicSlug: true, name: true, type: true, lat: true, lng: true, city: true },
  })
  return { data: { ...church, lat: Number(church.lat), lng: Number(church.lng) } }
}

/** Haversine (m) — usado só para anexar distância no perfil quando lat/lng vêm na query. */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}
