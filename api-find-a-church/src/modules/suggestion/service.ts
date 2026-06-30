import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { getFieldRisk } from '@/lib/risk'
import { prisma } from '@/lib/prisma'
import { createSuggestion, getSuggestionById, listSuggestions } from './repository'
import { recordRevision } from '@/modules/revision/repository'
import { createSuggestionBodySchema, listSuggestionsQuerySchema, suggestionSchema } from './schema'

type CreateBody = z.infer<typeof createSuggestionBodySchema>

function toDto(s: Awaited<ReturnType<typeof getSuggestionById>>): z.infer<typeof suggestionSchema> {
  if (!s) throw new NotFoundError('Sugestão não encontrada.')
  return {
    id: s.id,
    targetType: s.targetType,
    targetId: s.targetId,
    field: s.field,
    currentValue: s.currentValue,
    proposedValue: s.proposedValue,
    riskTier: s.riskTier,
    status: s.status,
    source: s.source as z.infer<typeof suggestionSchema>['source'],
    submittedByRef: s.submittedByRef,
    confidence: s.confidence,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  }
}

// Maps user-facing SuggestionField enum → actual Prisma Church field name
const CHURCH_FIELD_MAP: Record<string, string> = {
  NAME: 'name',
  PHONE: 'phone',
  ADDRESS: 'addressLine',
  TYPE: 'type',
  COORDINATES: 'lat', // representative field; approving COORDINATES needs special handling
}

async function getCurrentValue(targetType: string, targetId: number, field: string): Promise<string | null> {
  if (targetType === 'Church') {
    const church = await prisma.church.findUnique({ where: { id: targetId } })
    if (!church) return null
    const prismaField = CHURCH_FIELD_MAP[field] ?? field
    if (field === 'COORDINATES') {
      // Show "lat, lng" as the current value
      return `${church.lat}, ${church.lng}`
    }
    const val = (church as Record<string, unknown>)[prismaField]
    return val != null ? String(val) : null
  }
  if (targetType === 'MassSchedule') {
    const ms = await prisma.massSchedule.findUnique({ where: { id: targetId } })
    if (!ms) return null
    const val = (ms as Record<string, unknown>)[field]
    return val != null ? String(val) : null
  }
  return null
}

/** Aplica diretamente uma sugestão de baixo risco ao dado. */
async function applyLowRiskSuggestion(
  targetType: string,
  targetId: number,
  field: string,
  oldValue: string | null,
  newValue: string,
  suggestionId: number,
  submittedByRef: string | null,
) {
  if (targetType === 'Church') {
    await prisma.church.update({
      where: { id: targetId },
      data: { [field]: newValue },
    })
  } else if (targetType === 'MassSchedule') {
    await prisma.massSchedule.update({
      where: { id: targetId },
      data: { [field]: newValue },
    })
  }
  await recordRevision({
    entity: targetType,
    entityId: targetId,
    field,
    oldValue,
    newValue,
    changedByRef: submittedByRef,
    source: 'SUGGESTION',
    suggestionId,
  })
}

export async function suggestChurchField(churchId: number, body: CreateBody) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const riskTier = getFieldRisk('Church', body.field)
  const currentValue = await getCurrentValue('Church', churchId, body.field)

  const suggestion = await createSuggestion({
    targetType: 'Church',
    targetId: churchId,
    field: body.field,
    currentValue,
    proposedValue: body.proposedValue,
    riskTier,
    status: riskTier === 'LOW' ? 'APPLIED' : 'PENDING',
    source: body.source,
    submittedByRef: body.submittedByRef ?? null,
    confidence: 0.8,
    notes: body.notes ?? null,
  })

  if (riskTier === 'LOW') {
    await applyLowRiskSuggestion('Church', churchId, body.field, currentValue, body.proposedValue, suggestion.id, body.submittedByRef ?? null)
  }

  return { data: toDto(suggestion) }
}

export async function suggestMassScheduleField(massId: number, body: CreateBody) {
  const ms = await prisma.massSchedule.findUnique({ where: { id: massId } })
  if (!ms) throw new NotFoundError(`Horário ${massId} não encontrado.`)

  const riskTier = getFieldRisk('MassSchedule', body.field)
  const currentValue = await getCurrentValue('MassSchedule', massId, body.field)

  const suggestion = await createSuggestion({
    targetType: 'MassSchedule',
    targetId: massId,
    field: body.field,
    currentValue,
    proposedValue: body.proposedValue,
    riskTier,
    status: riskTier === 'LOW' ? 'APPLIED' : 'PENDING',
    source: body.source,
    submittedByRef: body.submittedByRef ?? null,
    confidence: 0.8,
    notes: body.notes ?? null,
  })

  if (riskTier === 'LOW') {
    await applyLowRiskSuggestion('MassSchedule', massId, body.field, currentValue, body.proposedValue, suggestion.id, body.submittedByRef ?? null)
  }

  return { data: toDto(suggestion) }
}

export async function listChurchSuggestions(churchId: number, query: z.infer<typeof listSuggestionsQuerySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const { rows, total } = await listSuggestions({
    targetType: 'Church',
    targetId: churchId,
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  })

  return {
    data: rows.map(toDto),
    meta: { page: query.page, pageSize: query.pageSize, total },
  }
}
