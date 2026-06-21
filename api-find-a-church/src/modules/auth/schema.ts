import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const registerBodySchema = z.object({
  name: z.string().min(2).max(100).openapi({ description: 'Nome do usuário.' }),
  email: z.string().email().max(200).openapi({ description: 'E-mail único.' }),
  password: z.string().min(8).max(128).openapi({ description: 'Senha (mín. 8 caracteres).' }),
})

export const loginBodySchema = z.object({
  email: z.string().email().openapi({ description: 'E-mail cadastrado.' }),
  password: z.string().min(1).openapi({ description: 'Senha.' }),
})

export const authResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    reputation: z.number(),
    isPlatformAdmin: z.boolean(),
    createdAt: z.string().datetime(),
    token: z.string(),
  })
  .openapi('AuthResponse')

export const meSchema = z
  .object({
    id: z.number().int(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    reputation: z.number(),
    isPlatformAdmin: z.boolean(),
    createdAt: z.string().datetime(),
    guardianOf: z.array(z.number().int()),
    parishAdminOf: z.array(z.number().int()),
  })
  .openapi('Me')

export const registerAuthPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Dados inválidos', content: { 'application/json': { schema: errorRef } } }
  const error401 = { description: 'Credenciais inválidas', content: { 'application/json': { schema: errorRef } } }
  const error409 = { description: 'E-mail já cadastrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/auth/register',
    summary: 'Cadastra novo usuário com e-mail e senha.',
    tags: ['Auth'],
    request: { body: { content: { 'application/json': { schema: registerBodySchema } } } },
    responses: {
      201: {
        description: 'Usuário criado + token',
        content: { 'application/json': { schema: successSchema(authResponseSchema) } },
      },
      400: error400,
      409: error409,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/auth/login',
    summary: 'Autentica usuário com e-mail e senha; retorna token.',
    tags: ['Auth'],
    request: { body: { content: { 'application/json': { schema: loginBodySchema } } } },
    responses: {
      200: {
        description: 'Token de acesso',
        content: { 'application/json': { schema: successSchema(authResponseSchema) } },
      },
      400: error400,
      401: error401,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/users/me',
    summary: 'Retorna dados do usuário autenticado com suas permissões.',
    tags: ['Users'],
    responses: {
      200: {
        description: 'Perfil do usuário com papéis',
        content: { 'application/json': { schema: successSchema(meSchema) } },
      },
      401: error401,
    },
  })
}
