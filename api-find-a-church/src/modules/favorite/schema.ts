import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'
import { churchSummarySchema } from '@/modules/church/schema'

export const churchIdParamSchema = z.object({
  churchId: z.coerce.number().int().positive(),
})

export const favoritesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const favoriteSchema = z
  .object({
    churchId: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .openapi('Favorite')

export const registerFavoritePaths: DocRegistrar = (registry, errorRef) => {
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'get',
    path: '/api/users/me/favorites',
    summary: 'Lista igrejas favoritas do usuário autenticado (RF26).',
    tags: ['Favorites'],
    responses: {
      200: {
        description: 'Lista paginada de favoritas',
        content: { 'application/json': { schema: successSchema(z.array(churchSummarySchema), true) } },
      },
      401: error401,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/users/me/favorites/{churchId}',
    summary: 'Adiciona uma igreja às favoritas (RF26). Idempotente.',
    tags: ['Favorites'],
    request: { params: churchIdParamSchema },
    responses: {
      201: {
        description: 'Favorita adicionada',
        content: { 'application/json': { schema: successSchema(favoriteSchema) } },
      },
      200: {
        description: 'Já era favorita',
        content: { 'application/json': { schema: successSchema(favoriteSchema) } },
      },
      401: error401,
      404: error404,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/users/me/favorites/{churchId}',
    summary: 'Remove uma igreja das favoritas.',
    tags: ['Favorites'],
    request: { params: churchIdParamSchema },
    responses: {
      204: { description: 'Removida' },
      401: error401,
    },
  })
}
