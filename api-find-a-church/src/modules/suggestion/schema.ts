import { z, successSchema, type DocRegistrar } from '@/lib/openapi'
import { env } from '@/config/env'

export const SUGGESTION_STATUSES = ['PENDING', 'APPLIED', 'REJECTED', 'IN_REVIEW'] as const
export const SUGGESTION_SOURCES = ['APP', 'WHATSAPP', 'TELEGRAM', 'FORM', 'ENRICHMENT'] as const
export const RISK_TIERS = ['LOW', 'HIGH'] as const

// ───────────────────── Entrada ─────────────────────

export const createSuggestionBodySchema = z.object({
  field: z.string().min(1).openapi({ description: 'Campo a corrigir (ex: "phone", "startTime").' }),
  proposedValue: z.string().min(1).openapi({ description: 'Valor proposto para o campo.' }),
  notes: z.string().max(500).optional().openapi({ description: 'Observação opcional do sugeridor.' }),
  submittedByRef: z.string().optional().openapi({ description: 'Referência anônima do dispositivo.' }),
  source: z.enum(SUGGESTION_SOURCES).default('APP'),
})

export const listSuggestionsQuerySchema = z.object({
  status: z.enum(SUGGESTION_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const suggestionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const churchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const massIdParamSchema = z.object({
  massId: z.coerce.number().int().positive(),
})

// ───────────────────── Saída ─────────────────────

export const suggestionSchema = z
  .object({
    id: z.number().int(),
    targetType: z.string(),
    targetId: z.number().int(),
    field: z.string(),
    currentValue: z.string().nullable(),
    proposedValue: z.string(),
    riskTier: z.enum(RISK_TIERS),
    status: z.enum(SUGGESTION_STATUSES),
    source: z.enum(SUGGESTION_SOURCES),
    submittedByRef: z.string().nullable(),
    confidence: z.number(),
    notes: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Suggestion')

// ───────────────────── OpenAPI paths ─────────────────────

export const registerSuggestionPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/churches/{id}/suggestions',
    summary: 'Sugere correção de um campo da igreja (RF22). Risco baixo aplica direto; alto fica pendente.',
    tags: ['Suggestions'],
    request: {
      params: churchIdParamSchema,
      body: { content: { 'application/json': { schema: createSuggestionBodySchema } } },
    },
    responses: {
      201: {
        description: 'Sugestão criada (status APPLIED ou PENDING)',
        content: { 'application/json': { schema: successSchema(suggestionSchema) } },
      },
      400: error400,
      404: error404,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/mass/{massId}/suggestions',
    summary: 'Sugere correção de um campo de horário de missa.',
    tags: ['Suggestions'],
    request: {
      params: massIdParamSchema,
      body: { content: { 'application/json': { schema: createSuggestionBodySchema } } },
    },
    responses: {
      201: { description: 'Sugestão criada', content: { 'application/json': { schema: successSchema(suggestionSchema) } } },
      400: error400,
      404: error404,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}/suggestions',
    summary: 'Lista sugestões de uma igreja (admin).',
    tags: ['Suggestions'],
    request: { params: churchIdParamSchema, query: listSuggestionsQuerySchema },
    responses: {
      200: {
        description: 'Lista paginada',
        content: { 'application/json': { schema: successSchema(z.array(suggestionSchema), true) } },
      },
      404: error404,
    },
  })
}
