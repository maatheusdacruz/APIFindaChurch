import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'

export const PARISH_STATUSES = ['UNCLAIMED', 'PROVISIONAL', 'VERIFIED'] as const

export const claimParishBodySchema = z.object({
  name: z.string().min(2).openapi({ description: 'Nome da paróquia.' }),
  verificationChannel: z
    .enum(['DIOCESE', 'PHYSICAL_PRESENCE', 'FORM'])
    .openapi({ description: 'Canal de verificação da reivindicação.' }),
  notes: z.string().max(500).optional(),
})

export const addChurchesToParishBodySchema = z.object({
  churchIds: z.array(z.number().int().positive()).min(1).openapi({ description: 'IDs das igrejas a associar.' }),
})

export const parishIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const parishSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    status: z.enum(PARISH_STATUSES),
    churchCount: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .openapi('Parish')

export const listParishesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const registerParishPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error403 = { description: 'Proibido', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'get',
    path: '/api/parishes',
    summary: 'Lista paróquias.',
    tags: ['Parishes'],
    request: { query: listParishesQuerySchema },
    responses: {
      200: {
        description: 'Paróquias paginadas',
        content: { 'application/json': { schema: successSchema(z.array(parishSchema), true) } },
      },
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/parishes/claim',
    summary: 'Reivindica administração de uma paróquia (RN01). Requer autenticação.',
    tags: ['Parishes'],
    request: { body: { content: { 'application/json': { schema: claimParishBodySchema } } } },
    responses: {
      201: {
        description: 'Paróquia reivindicada (status PROVISIONAL)',
        content: { 'application/json': { schema: successSchema(parishSchema) } },
      },
      400: error400,
      401: error401,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/parishes/{id}/churches',
    summary: 'Admin declara igrejas de uma paróquia (RN10/RN11). Requer papel AdminRole.',
    tags: ['Parishes'],
    request: {
      params: parishIdParamSchema,
      body: { content: { 'application/json': { schema: addChurchesToParishBodySchema } } },
    },
    responses: {
      200: {
        description: 'Igrejas associadas',
        content: {
          'application/json': {
            schema: successSchema(z.object({ added: z.number().int(), parishId: z.number().int() })),
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
