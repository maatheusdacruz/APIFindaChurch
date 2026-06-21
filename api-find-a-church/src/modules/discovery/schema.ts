import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { churchSummarySchema, CHURCH_TYPES } from '@/modules/church/schema'
import { env } from '@/config/env'

export const travelQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce
    .number()
    .int()
    .positive()
    .max(env.NEAR_MAX_RADIUS_M)
    .default(env.NEAR_DEFAULT_RADIUS_M),
})

export const travelDiscoverySchema = z
  .object({
    city: z.string().nullable(),
    highlights: z.array(churchSummarySchema).openapi({ description: 'Basílicas, santuários e mosteiros próximos.' }),
    nearby: z.array(churchSummarySchema).openapi({ description: 'Igrejas próximas em geral.' }),
  })
  .openapi('TravelDiscovery')

export const registerDiscoveryPaths: DocRegistrar = (registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/discovery/travel',
    summary: 'Detecta cidade nova por lat/lng e destaca igrejas especiais (RF08).',
    tags: ['Discovery'],
    request: { query: travelQuerySchema },
    responses: {
      200: {
        description: 'Igrejas descobertas em viagem',
        content: { 'application/json': { schema: successSchema(travelDiscoverySchema) } },
      },
    },
  })
}
