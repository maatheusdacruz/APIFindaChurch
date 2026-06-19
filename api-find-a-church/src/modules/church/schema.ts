import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'

// ───────────────────────────── Enums ─────────────────────────────
export const CHURCH_TYPES = ['IGREJA', 'CAPELA', 'BASILICA', 'SANTUARIO', 'MOSTEIRO', 'SEMINARIO'] as const
export const MASS_KINDS = ['MISSA', 'CONFISSAO', 'ADORACAO'] as const

const churchTypeEnum = z.enum(CHURCH_TYPES)
const massKindEnum = z.enum(MASS_KINDS)

const lat = z.coerce.number().min(-90).max(90)
const lng = z.coerce.number().min(-180).max(180)

/** Aceita `?type=A&type=B` (array) ou `?type=A` (string) → array. */
const typeArray = z
  .preprocess(
    (v) => (v === undefined ? undefined : Array.isArray(v) ? v : String(v).split(',')),
    z.array(churchTypeEnum),
  )
  .optional()

// ───────────────────────── Entrada (query/params) ─────────────────────────

export const listQuerySchema = z.object({
  type: typeArray.openapi({ description: 'Filtra por tipo (repetível ou CSV).' }),
  q: z.string().trim().min(1).optional().openapi({ description: 'Busca por nome.' }),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'bbox = minLng,minLat,maxLng,maxLat')
    .optional()
    .openapi({ description: 'Caixa do mapa: minLng,minLat,maxLng,maxLat' }),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const nearQuerySchema = z.object({
  lat,
  lng,
  radius_m: z.coerce
    .number()
    .int()
    .positive()
    .max(env.NEAR_MAX_RADIUS_M)
    .default(env.NEAR_DEFAULT_RADIUS_M),
  kind: massKindEnum.optional().openapi({ description: 'Filtra igrejas com horário deste tipo.' }),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const profileQuerySchema = z.object({
  lat: lat.optional(),
  lng: lng.optional(),
})

export const eventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

// ───────────────────────── Saída (DTOs documentados) ─────────────────────────

export const freshnessSchema = z
  .object({
    lastConfirmedAt: z.string().datetime().nullable(),
    source: z.string(),
    confidence: z.number(),
    ageDays: z.number().int().nullable(),
    stale: z.boolean(),
  })
  .openapi('Freshness')

export const massScheduleSchema = z
  .object({
    id: z.number().int(),
    kind: massKindEnum,
    dayOfWeek: z.number().int().nullable(),
    date: z.string().nullable(),
    startTime: z.string(),
    note: z.string().nullable(),
    nextAt: z.string().datetime().nullable(),
    freshness: freshnessSchema,
  })
  .openapi('MassSchedule')

export const churchAttributeSchema = z
  .object({
    acessibilidade: z.boolean(),
    estacionamento: z.boolean(),
    livraria: z.boolean(),
    adoracao: z.boolean(),
    confissao: z.boolean(),
    grupoJovens: z.boolean(),
    catequese: z.boolean(),
  })
  .openapi('ChurchAttribute')

export const churchSummarySchema = z
  .object({
    id: z.number().int(),
    publicSlug: z.string(),
    name: z.string(),
    type: churchTypeEnum,
    lat: z.number(),
    lng: z.number(),
    city: z.string().nullable(),
    distanceM: z.number().nullable(),
    nextMassAt: z.string().datetime().nullable(),
    freshness: freshnessSchema.nullable(),
  })
  .openapi('ChurchSummary')

export const churchProfileSchema = z
  .object({
    id: z.number().int(),
    publicSlug: z.string(),
    name: z.string(),
    type: churchTypeEnum,
    lat: z.number(),
    lng: z.number(),
    address: z.object({
      line: z.string().nullable(),
      district: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      postalCode: z.string().nullable(),
    }),
    phone: z.string().nullable(),
    photoUrl: z.string().nullable(),
    distanceM: z.number().nullable(),
    attributes: churchAttributeSchema,
    schedules: z.array(massScheduleSchema),
    freshness: freshnessSchema.nullable(),
  })
  .openapi('ChurchProfile')

export const eventSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    description: z.string().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
  })
  .openapi('Event')

// ───────────────────────────── OpenAPI paths ─────────────────────────────

export const registerChurchPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'get',
    path: '/api/churches',
    summary: 'Lista/busca igrejas (filtros: tipo, bbox, nome).',
    tags: ['Churches'],
    request: { query: listQuerySchema },
    responses: {
      200: {
        description: 'Lista paginada',
        content: { 'application/json': { schema: successSchema(z.array(churchSummarySchema), true) } },
      },
      400: error400,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/churches/near',
    summary: 'Igrejas próximas por raio, ordenadas por distância (PostGIS).',
    tags: ['Churches'],
    request: { query: nearQuerySchema },
    responses: {
      200: {
        description: 'Lista por distância crescente',
        content: { 'application/json': { schema: successSchema(z.array(churchSummarySchema), true) } },
      },
      400: error400,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}',
    summary: 'Perfil completo da igreja (horários, atributos, frescor).',
    tags: ['Churches'],
    request: { params: idParamSchema, query: profileQuerySchema },
    responses: {
      200: {
        description: 'Perfil',
        content: { 'application/json': { schema: successSchema(churchProfileSchema) } },
      },
      404: error404,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}/events',
    summary: 'Próximos eventos da igreja.',
    tags: ['Churches'],
    request: { params: idParamSchema, query: eventsQuerySchema },
    responses: {
      200: {
        description: 'Eventos paginados',
        content: { 'application/json': { schema: successSchema(z.array(eventSchema), true) } },
      },
      404: error404,
    },
  })
}
