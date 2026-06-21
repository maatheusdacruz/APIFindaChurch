import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'

export const revisionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const churchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const revisionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const revisionSchema = z
  .object({
    id: z.number().int(),
    entity: z.string(),
    entityId: z.number().int(),
    field: z.string(),
    oldValue: z.string().nullable(),
    newValue: z.string(),
    changedByRef: z.string().nullable(),
    source: z.string(),
    reversibleOf: z.number().int().nullable(),
    suggestionId: z.number().int().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Revision')

export const registerRevisionPaths: DocRegistrar = (registry, errorRef) => {
  const error403 = { description: 'Proibido', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}/revisions',
    summary: 'Histórico de revisões de uma igreja (RF25).',
    tags: ['Revisions'],
    request: { params: churchIdParamSchema, query: revisionQuerySchema },
    responses: {
      200: {
        description: 'Revisões paginadas',
        content: { 'application/json': { schema: successSchema(z.array(revisionSchema), true) } },
      },
      404: error404,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/admin/revisions/{id}/revert',
    summary: 'Reverte uma revisão ao valor anterior (RN07). Requer x-admin-key.',
    tags: ['Admin'],
    request: { params: revisionIdParamSchema },
    responses: {
      201: {
        description: 'Revisão de reversão criada',
        content: { 'application/json': { schema: successSchema(revisionSchema) } },
      },
      403: error403,
      404: error404,
    },
  })
}
