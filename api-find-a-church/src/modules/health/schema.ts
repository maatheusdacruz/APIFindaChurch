import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const healthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    uptimeSec: z.number(),
    db: z.object({
      connected: z.boolean(),
      postgisVersion: z.string().nullable(),
    }),
  })
  .openapi('Health')

export const registerHealthPaths: DocRegistrar = (registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    summary: 'Status do app e do banco (inclui versão do PostGIS).',
    tags: ['System'],
    responses: {
      200: {
        description: 'Tudo ok',
        content: { 'application/json': { schema: successSchema(healthSchema) } },
      },
      503: {
        description: 'Banco indisponível',
        content: { 'application/json': { schema: successSchema(healthSchema) } },
      },
    },
  })
}
