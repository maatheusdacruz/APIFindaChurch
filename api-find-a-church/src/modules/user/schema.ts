import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const registerUserBodySchema = z.object({
  deviceId: z.string().min(8).max(128).openapi({ description: 'ID único do dispositivo (gerado pelo cliente).' }),
})

export const pushTokenBodySchema = z.object({
  pushToken: z.string().min(1).openapi({ description: 'Token de push notification (FCM/APNs).' }),
})

export const userSchema = z
  .object({
    id: z.number().int(),
    deviceId: z.string(),
    reputation: z.number(),
    createdAt: z.string().datetime(),
    token: z.string().optional().openapi({ description: 'Token de autenticação (retornado só no registro/login).' }),
  })
  .openapi('User')

export const registerUserPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error409 = { description: 'Conflito', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/users',
    summary: 'Registra usuário anônimo por deviceId; retorna token leve (Fase 3).',
    tags: ['Users'],
    request: { body: { content: { 'application/json': { schema: registerUserBodySchema } } } },
    responses: {
      201: {
        description: 'Usuário registrado + token',
        content: { 'application/json': { schema: successSchema(userSchema) } },
      },
      200: {
        description: 'Usuário já existia; retorna token',
        content: { 'application/json': { schema: successSchema(userSchema) } },
      },
      400: error400,
      409: error409,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/api/users/me/push-token',
    summary: 'Registra ou atualiza push token do usuário autenticado.',
    tags: ['Users'],
    request: { body: { content: { 'application/json': { schema: pushTokenBodySchema } } } },
    responses: {
      200: {
        description: 'Token salvo',
        content: { 'application/json': { schema: successSchema(userSchema) } },
      },
      400: error400,
    },
  })
}
