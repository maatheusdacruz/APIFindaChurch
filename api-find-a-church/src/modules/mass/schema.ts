import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'
import { freshnessSchema, CHURCH_TYPES, MASS_KINDS } from '@/modules/church/schema'

const lat = z.coerce.number().min(-90).max(90)
const lng = z.coerce.number().min(-180).max(180)

export const massNowQuerySchema = z.object({
  lat,
  lng,
  window_min: z.coerce
    .number()
    .int()
    .positive()
    .max(env.MASS_NOW_MAX_WINDOW_MIN)
    .default(env.MASS_NOW_WINDOW_MIN),
  radius_m: z.coerce
    .number()
    .int()
    .positive()
    .max(env.NEAR_MAX_RADIUS_M)
    .default(env.NEAR_DEFAULT_RADIUS_M),
  kind: z.enum(MASS_KINDS).optional(),
  limit: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const massNowItemSchema = z
  .object({
    churchId: z.number().int(),
    publicSlug: z.string(),
    churchName: z.string(),
    type: z.enum(CHURCH_TYPES),
    lat: z.number(),
    lng: z.number(),
    city: z.string().nullable(),
    distanceM: z.number().nullable(),
    mass: z.object({
      id: z.number().int(),
      kind: z.enum(MASS_KINDS),
      startTime: z.string(),
      note: z.string().nullable(),
      nextAt: z.string().datetime(),
      minutesUntil: z.number().int(),
      freshness: freshnessSchema,
    }),
  })
  .openapi('MassNowItem')

export const registerMassPaths: DocRegistrar = (registry, errorRef) => {
  registry.registerPath({
    method: 'get',
    path: '/api/mass/now',
    summary: 'Missa Agora: missas começando dentro da janela, perto, ordenadas por horário+distância.',
    tags: ['Mass'],
    request: { query: massNowQuerySchema },
    responses: {
      200: {
        description: 'Missas na janela',
        content: { 'application/json': { schema: successSchema(z.array(massNowItemSchema), true) } },
      },
      400: { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } },
    },
  })
}
