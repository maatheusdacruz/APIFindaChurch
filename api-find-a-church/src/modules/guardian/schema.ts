import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const GUARDIAN_STATUSES = ['PENDING', 'ACTIVE', 'FROZEN', 'REMOVED'] as const

export const claimGuardianBodySchema = z.object({
  notes: z.string().max(500).optional().openapi({ description: 'Nota de justificativa para a reivindicação.' }),
})

export const contestBodySchema = z.object({
  parishId: z.number().int().positive().openapi({ description: 'ID da paróquia contestada.' }),
  reason: z.string().min(10).openapi({ description: 'Motivo da contestação.' }),
})

export const guardianSchema = z
  .object({
    id: z.number().int(),
    churchId: z.number().int(),
    userId: z.number().int(),
    status: z.enum(GUARDIAN_STATUSES),
    behavioralScore: z.number(),
    claimedAt: z.string().datetime(),
  })
  .openapi('GuardianRole')

export const registerGuardianPaths: DocRegistrar = (registry, errorRef) => {
  const idParam = z.object({ id: z.coerce.number().int().positive() })
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error403 = { description: 'Proibido', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }
  const error409 = { description: 'Conflito', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/churches/{id}/guardian/claim',
    summary: 'Reivindica papel de guardião de uma igreja (RN02). Requer autenticação.',
    tags: ['Guardians'],
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: claimGuardianBodySchema } } },
    },
    responses: {
      201: {
        description: 'Guardião reivindicado',
        content: { 'application/json': { schema: successSchema(guardianSchema) } },
      },
      400: error400,
      401: error401,
      404: error404,
      409: error409,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}/guardian',
    summary: 'Retorna o guardião ativo de uma igreja.',
    tags: ['Guardians'],
    request: { params: idParam },
    responses: {
      200: {
        description: 'Guardião ativo',
        content: { 'application/json': { schema: successSchema(guardianSchema.nullable()) } },
      },
      404: error404,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/churches/{id}/contest',
    summary: 'Guardião contesta absorção de sua igreja por uma paróquia (RN12).',
    tags: ['Guardians'],
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: contestBodySchema } } },
    },
    responses: {
      200: {
        description: 'Contestação registrada',
        content: {
          'application/json': {
            schema: successSchema(z.object({ churchId: z.number(), parishId: z.number(), contested: z.boolean() })),
          },
        },
      },
      400: error400,
      401: error401,
      403: error403,
      404: error404,
    },
  })
}
