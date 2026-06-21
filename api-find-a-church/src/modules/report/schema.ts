import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const TARGET_TYPES = ['GuardianRole', 'MuralPost', 'Suggestion'] as const

export const createReportBodySchema = z.object({
  targetType: z.enum(TARGET_TYPES).openapi({ description: 'Tipo do alvo da denúncia.' }),
  targetId: z.number().int().positive().openapi({ description: 'ID do alvo.' }),
  reason: z.string().min(10).max(1000).openapi({ description: 'Motivo da denúncia.' }),
  reporterRef: z.string().optional().openapi({ description: 'Referência anônima do denunciante.' }),
})

export const reportSchema = z
  .object({
    id: z.number().int(),
    targetType: z.string(),
    targetId: z.number().int(),
    reason: z.string(),
    createdAt: z.string().datetime(),
    autoFreezeTriggered: z.boolean(),
  })
  .openapi('Report')

export const registerReportPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/reports',
    summary: 'Denuncia um guardião, post do mural ou sugestão (RN08). Acima do limiar, congela automaticamente.',
    tags: ['Reports'],
    request: { body: { content: { 'application/json': { schema: createReportBodySchema } } } },
    responses: {
      201: {
        description: 'Denúncia registrada',
        content: { 'application/json': { schema: successSchema(reportSchema) } },
      },
      400: error400,
      404: error404,
    },
  })
}
