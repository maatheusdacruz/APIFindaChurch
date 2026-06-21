import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const feedbackBodySchema = z.object({
  value: z.enum(['CONFIRM', 'DENY']).openapi({ description: 'CONFIRM = horário correto; DENY = horário incorreto.' }),
  deviceRef: z.string().optional().openapi({ description: 'Referência anônima do dispositivo.' }),
})

export const massIdParamSchema = z.object({
  massId: z.coerce.number().int().positive(),
})

export const feedbackSchema = z
  .object({
    id: z.number().int(),
    targetType: z.string(),
    targetId: z.number().int(),
    value: z.enum(['CONFIRM', 'DENY']),
    deviceRef: z.string().nullable(),
    createdAt: z.string().datetime(),
    freshnessUpdated: z.boolean(),
  })
  .openapi('Feedback')

export const registerFeedbackPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/mass/{massId}/feedback',
    summary: 'Micro-feedback de um toque: confirma ou nega horário de missa (RF23).',
    tags: ['Feedback'],
    request: {
      params: massIdParamSchema,
      body: { content: { 'application/json': { schema: feedbackBodySchema } } },
    },
    responses: {
      201: {
        description: 'Feedback registrado',
        content: { 'application/json': { schema: successSchema(feedbackSchema) } },
      },
      400: error400,
      404: error404,
    },
  })
}
