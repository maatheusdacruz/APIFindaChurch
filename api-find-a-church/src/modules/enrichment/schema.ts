import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const ingestEnrichmentBodySchema = z.object({
  origin: z.string().min(1).openapi({ description: 'Origem dos dados: "google_places", "site", "diocese", etc.' }),
  churchId: z.number().int().positive().optional().openapi({ description: 'ID da igreja, se já identificada.' }),
  fields: z.record(z.string(), z.string()).openapi({ description: 'Campos e valores a ingerir.' }),
  quality: z.number().min(0).max(1).optional().openapi({ description: 'Score de qualidade da fonte (0–1).' }),
  coverage: z.number().min(0).max(1).optional().openapi({ description: 'Cobertura dos campos (0–1).' }),
})

export const ingestMessageBodySchema = z.object({
  source: z.enum(['WHATSAPP', 'TELEGRAM', 'FORM']),
  senderRef: z.string().optional().openapi({ description: 'Ref anônima do remetente.' }),
  rawText: z.string().min(1).openapi({ description: 'Texto livre recebido via webhook.' }),
  churchId: z.number().int().positive().optional().openapi({ description: 'ID da igreja, se identificado pelo canal.' }),
})

export const enrichmentResultSchema = z
  .object({
    jobId: z.number().int(),
    origin: z.string(),
    matchedChurchId: z.number().int().nullable(),
    suggestionsCreated: z.number().int(),
    revisionsApplied: z.number().int(),
    status: z.string(),
  })
  .openapi('EnrichmentResult')

export const messageIngestResultSchema = z
  .object({
    suggestionsCreated: z.number().int(),
    rawText: z.string(),
    parsedFields: z.array(z.object({ field: z.string(), proposedValue: z.string() })),
  })
  .openapi('MessageIngestResult')

export const coverageReportSchema = z
  .object({
    origin: z.string(),
    totalJobs: z.number().int(),
    doneJobs: z.number().int(),
    avgCoverage: z.number().nullable(),
    avgQuality: z.number().nullable(),
  })
  .openapi('CoverageReport')

export const registerEnrichmentPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/ingest/enrichment',
    summary: 'Ingere dados enriquecidos (Google Places, site, diocese) → sugestões/revisões (RF21).',
    tags: ['Enrichment'],
    request: { body: { content: { 'application/json': { schema: ingestEnrichmentBodySchema } } } },
    responses: {
      201: {
        description: 'Resultado da ingestão',
        content: { 'application/json': { schema: successSchema(enrichmentResultSchema) } },
      },
      400: error400,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/ingest/message',
    summary: 'Webhook WhatsApp/Telegram/formulário → sugestão estruturada (RF24).',
    tags: ['Enrichment'],
    request: { body: { content: { 'application/json': { schema: ingestMessageBodySchema } } } },
    responses: {
      201: {
        description: 'Sugestões criadas a partir da mensagem',
        content: { 'application/json': { schema: successSchema(messageIngestResultSchema) } },
      },
      400: error400,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/ingest/coverage',
    summary: 'Relatório de cobertura e qualidade por fonte de enriquecimento (DP3).',
    tags: ['Enrichment'],
    responses: {
      200: {
        description: 'Cobertura por origem',
        content: { 'application/json': { schema: successSchema(z.array(coverageReportSchema)) } },
      },
    },
  })
}
