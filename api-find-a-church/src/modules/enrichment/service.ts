import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getFieldRisk } from '@/lib/risk'
import { createSuggestion } from '@/modules/suggestion/repository'
import { recordRevision } from '@/modules/revision/repository'
import { ingestEnrichmentBodySchema, ingestMessageBodySchema } from './schema'

/** Upsert EnrichmentSource pelo origin string. */
async function upsertSource(origin: string) {
  return prisma.enrichmentSource.upsert({
    where: { origin },
    create: { origin },
    update: {},
  })
}

export async function ingestEnrichment(body: z.infer<typeof ingestEnrichmentBodySchema>) {
  const source = await upsertSource(body.origin)

  const job = await prisma.enrichmentJob.create({
    data: {
      sourceId: source.id,
      status: 'PROCESSING',
      payload: body.fields as object,
      matchedChurchId: body.churchId ?? null,
      coverage: body.coverage ?? null,
      quality: body.quality ?? null,
    },
  })

  let suggestionsCreated = 0
  let revisionsApplied = 0

  if (body.churchId) {
    for (const [field, value] of Object.entries(body.fields)) {
      const riskTier = getFieldRisk('Church', field)
      const currentVal = await getCurrentFieldValue('Church', body.churchId, field)

      if (riskTier === 'LOW') {
        // Aplica direto
        try {
          await prisma.church.update({ where: { id: body.churchId }, data: { [field]: value } })
          const suggestion = await createSuggestion({
            targetType: 'Church',
            targetId: body.churchId,
            field,
            currentValue: currentVal,
            proposedValue: value,
            riskTier: 'LOW',
            status: 'APPLIED',
            source: 'ENRICHMENT',
            submittedByRef: body.origin,
            confidence: body.quality ?? 0.7,
            notes: null,
          })
          await recordRevision({
            entity: 'Church',
            entityId: body.churchId,
            field,
            oldValue: currentVal,
            newValue: value,
            changedByRef: body.origin,
            source: 'ENRICHMENT',
            suggestionId: suggestion.id,
          })
          revisionsApplied++
        } catch {
          // Campo não existe no modelo; ignora silenciosamente.
        }
      } else {
        // Alto risco: cria sugestão pendente.
        await createSuggestion({
          targetType: 'Church',
          targetId: body.churchId,
          field,
          currentValue: currentVal,
          proposedValue: value,
          riskTier: 'HIGH',
          status: 'PENDING',
          source: 'ENRICHMENT',
          submittedByRef: body.origin,
          confidence: body.quality ?? 0.7,
          notes: `Enriquecimento automático de ${body.origin}`,
        })
        suggestionsCreated++
      }
    }
  }

  await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: { status: 'DONE' },
  })

  return {
    data: {
      jobId: job.id,
      origin: body.origin,
      matchedChurchId: body.churchId ?? null,
      suggestionsCreated,
      revisionsApplied,
      status: 'DONE',
    },
  }
}

/** Parseia texto livre de mensagem e cria sugestões estruturadas. */
export async function ingestMessage(body: z.infer<typeof ingestMessageBodySchema>) {
  const parsed = parseRawText(body.rawText)
  let suggestionsCreated = 0

  if (body.churchId && parsed.length > 0) {
    for (const { field, proposedValue } of parsed) {
      const riskTier = getFieldRisk('Church', field)
      const currentValue = await getCurrentFieldValue('Church', body.churchId, field)
      await createSuggestion({
        targetType: 'Church',
        targetId: body.churchId,
        field,
        currentValue,
        proposedValue,
        riskTier,
        status: riskTier === 'LOW' ? 'APPLIED' : 'PENDING',
        source: body.source,
        submittedByRef: body.senderRef ?? null,
        confidence: 0.5,
        notes: `Via ${body.source}: "${body.rawText.slice(0, 100)}"`,
      })
      suggestionsCreated++
    }
  }

  return {
    data: {
      suggestionsCreated,
      rawText: body.rawText,
      parsedFields: parsed,
    },
  }
}

/** Extrai pares campo/valor do texto livre (regex básico). */
function parseRawText(text: string): { field: string; proposedValue: string }[] {
  const results: { field: string; proposedValue: string }[] = []
  // Padrão: "telefone: (11) 9999-9999", "horário: 19:00", "foto: https://..."
  const patterns: [RegExp, string][] = [
    [/(?:telefone|fone|tel)[:\s]+([^\n,;]+)/i, 'phone'],
    [/(?:horário|missa)[:\s]+([\d:]+)/i, 'startTime'],
    [/(?:endereço|rua|av)[:\s]+([^\n,;]+)/i, 'addressLine'],
    [/(?:foto|imagem|url)[:\s]+(https?:\/\/[^\s]+)/i, 'photoUrl'],
  ]
  for (const [regex, field] of patterns) {
    const match = regex.exec(text)
    if (match) results.push({ field, proposedValue: match[1].trim() })
  }
  return results
}

export async function getCoverageReport() {
  const sources = await prisma.enrichmentSource.findMany({
    include: { jobs: true },
  })

  return {
    data: sources.map((s) => {
      const done = s.jobs.filter((j) => j.status === 'DONE')
      const avgCov = done.length ? done.reduce((a, j) => a + (j.coverage ?? 0), 0) / done.length : null
      const avgQual = done.length ? done.reduce((a, j) => a + (j.quality ?? 0), 0) / done.length : null
      return {
        origin: s.origin,
        totalJobs: s.jobs.length,
        doneJobs: done.length,
        avgCoverage: avgCov,
        avgQuality: avgQual,
      }
    }),
  }
}

async function getCurrentFieldValue(entity: string, entityId: number, field: string): Promise<string | null> {
  if (entity === 'Church') {
    const church = await prisma.church.findUnique({ where: { id: entityId } })
    if (!church) return null
    const val = (church as Record<string, unknown>)[field]
    return val != null ? String(val) : null
  }
  return null
}
