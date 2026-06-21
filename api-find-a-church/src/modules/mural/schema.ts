import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'

export const MURAL_POST_TYPES = ['AVISO', 'EVENTO', 'PEDIDO', 'CAMPANHA'] as const

export const createMuralPostBodySchema = z.object({
  type: z.enum(MURAL_POST_TYPES).openapi({ description: 'Tipo do post no mural.' }),
  content: z.string().min(10).max(2000).openapi({ description: 'Conteúdo do post.' }),
})

export const muralQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const churchIdParamSchema = z.object({ id: z.coerce.number().int().positive() })
export const postIdParamSchema = z.object({ id: z.coerce.number().int().positive(), postId: z.coerce.number().int().positive() })

export const muralPostSchema = z
  .object({
    id: z.number().int(),
    churchId: z.number().int(),
    type: z.enum(MURAL_POST_TYPES),
    content: z.string(),
    authorId: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('MuralPost')

export const registerMuralPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error403 = { description: 'Proibido', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}/mural',
    summary: 'Lista posts do mural de uma igreja (RF28).',
    tags: ['Mural'],
    request: { params: churchIdParamSchema, query: muralQuerySchema },
    responses: {
      200: {
        description: 'Posts paginados',
        content: { 'application/json': { schema: successSchema(z.array(muralPostSchema), true) } },
      },
      404: error404,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/churches/{id}/mural',
    summary: 'Cria post no mural. Requer papel de guardião ativo.',
    tags: ['Mural'],
    request: {
      params: churchIdParamSchema,
      body: { content: { 'application/json': { schema: createMuralPostBodySchema } } },
    },
    responses: {
      201: {
        description: 'Post criado',
        content: { 'application/json': { schema: successSchema(muralPostSchema) } },
      },
      400: error400,
      401: error401,
      403: error403,
      404: error404,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/churches/{id}/mural/{postId}',
    summary: 'Remove post do mural (autor ou guardião).',
    tags: ['Mural'],
    request: { params: postIdParamSchema },
    responses: {
      204: { description: 'Removido' },
      401: error401,
      403: error403,
      404: error404,
    },
  })
}
