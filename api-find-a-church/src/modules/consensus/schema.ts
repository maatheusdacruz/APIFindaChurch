import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const voteBodySchema = z.object({
  approve: z.boolean().openapi({ description: 'true = aprova a sugestão; false = rejeita.' }),
})

export const voteSchema = z
  .object({
    suggestionId: z.number().int(),
    outcome: z.enum(['PENDING', 'APPLIED', 'REJECTED']),
    totalWeight: z.number(),
    threshold: z.number(),
    myVote: z.boolean(),
  })
  .openapi('ConsensusVoteResult')

export const suggestionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const registerConsensusPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }
  const error409 = { description: 'Já votou', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/suggestions/{id}/vote',
    summary: 'Vota em uma sugestão pendente (RN05/RN06). Peso proporcional à reputação.',
    tags: ['Consensus'],
    request: {
      params: suggestionIdParamSchema,
      body: { content: { 'application/json': { schema: voteBodySchema } } },
    },
    responses: {
      200: {
        description: 'Voto registrado; retorna estado atual do consenso',
        content: { 'application/json': { schema: successSchema(voteSchema) } },
      },
      400: error400,
      401: error401,
      404: error404,
      409: error409,
    },
  })
}
