import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors'
import { recordRevision } from '@/modules/revision/repository'
import {
  createMSSuggestionBodySchema,
  listMSSuggestionsQuerySchema,
  msSuggestionSchema,
} from './schema'

type CreateBody = z.infer<typeof createMSSuggestionBodySchema>

function toDto(s: {
  id: number
  churchId: number
  changeType: string
  targetScheduleId: number | null
  kind: string
  dayOfWeek: number | null
  date: Date | null
  startTime: string | null
  note: string | null
  validFrom: Date | null
  validTo: Date | null
  status: string
  rejectionReason: string | null
  suggestedById: number | null
  reviewedById: number | null
  reviewedAt: Date | null
  createdAt: Date
}): z.infer<typeof msSuggestionSchema> {
  return {
    id: s.id,
    churchId: s.churchId,
    changeType: s.changeType as 'ADD' | 'EDIT' | 'DELETE',
    targetScheduleId: s.targetScheduleId,
    kind: s.kind as 'MISSA' | 'CONFISSAO' | 'ADORACAO',
    dayOfWeek: s.dayOfWeek,
    date: s.date ? s.date.toISOString().slice(0, 10) : null,
    startTime: s.startTime,
    note: s.note,
    validFrom: s.validFrom ? s.validFrom.toISOString() : null,
    validTo: s.validTo ? s.validTo.toISOString() : null,
    status: s.status as 'PENDENT' | 'REVISION' | 'APPLY' | 'REJECTED',
    rejectionReason: s.rejectionReason,
    suggestedById: s.suggestedById,
    reviewedById: s.reviewedById,
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }
}

export async function createMassScheduleSuggestion(
  churchId: number,
  body: CreateBody,
  suggestedById: number | null,
) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  if (body.changeType !== 'DELETE' && !body.startTime) {
    throw new ValidationError('startTime é obrigatório para ADD e EDIT.')
  }
  if (body.changeType !== 'ADD' && !body.targetScheduleId) {
    throw new ValidationError('targetScheduleId é obrigatório para EDIT e DELETE.')
  }
  if (body.changeType !== 'ADD' && body.targetScheduleId) {
    const existing = await prisma.massSchedule.findFirst({
      where: { id: body.targetScheduleId, churchId },
    })
    if (!existing) throw new NotFoundError(`Horário ${body.targetScheduleId} não encontrado nesta igreja.`)
  }

  const suggestion = await prisma.massScheduleSuggestion.create({
    data: {
      churchId,
      changeType: body.changeType,
      targetScheduleId: body.targetScheduleId ?? null,
      kind: body.kind,
      dayOfWeek: body.dayOfWeek ?? null,
      date: body.date ? new Date(body.date) : null,
      startTime: body.startTime ?? null,
      note: body.note ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
      status: 'PENDENT',
      suggestedById,
    },
  })

  return { data: toDto(suggestion) }
}

export async function listMassScheduleSuggestions(
  churchId: number,
  query: z.infer<typeof listMSSuggestionsQuerySchema>,
) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const where = {
    churchId,
    ...(query.status ? { status: query.status } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.massScheduleSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.massScheduleSuggestion.count({ where }),
  ])

  return {
    data: rows.map(toDto),
    meta: { page: query.page, pageSize: query.pageSize, total },
  }
}

export async function approveMassScheduleSuggestion(suggestionId: number, reviewerId: number) {
  const suggestion = await prisma.massScheduleSuggestion.findUnique({
    where: { id: suggestionId },
  })
  if (!suggestion) throw new NotFoundError(`Sugestão ${suggestionId} não encontrada.`)
  if (suggestion.status === 'APPLY') throw new ValidationError('Sugestão já aplicada.')
  if (suggestion.status === 'REJECTED') throw new ValidationError('Sugestão já rejeitada.')

  // Apply the change
  if (suggestion.changeType === 'ADD') {
    const startTime = suggestion.startTime
    if (!startTime) throw new ValidationError('Sugestão incompleta: falta startTime.')
    const created = await prisma.massSchedule.create({
      data: {
        churchId: suggestion.churchId,
        kind: suggestion.kind,
        dayOfWeek: suggestion.dayOfWeek,
        date: suggestion.date,
        startTime,
        note: suggestion.note,
        validFrom: suggestion.validFrom,
        validTo: suggestion.validTo,
        source: 'SUGGESTION',
        lastConfirmedAt: new Date(),
      },
    })
    await recordRevision({
      entity: 'MassSchedule',
      entityId: created.id,
      field: 'created',
      oldValue: null,
      newValue: JSON.stringify({ kind: suggestion.kind, startTime }),
      changedByRef: String(reviewerId),
      source: 'SUGGESTION',
    })
  } else if (suggestion.changeType === 'EDIT') {
    const targetScheduleId = suggestion.targetScheduleId
    const startTime = suggestion.startTime
    if (!targetScheduleId) throw new ValidationError('Sugestão incompleta: falta targetScheduleId.')
    if (!startTime) throw new ValidationError('Sugestão incompleta: falta startTime.')
    const before = await prisma.massSchedule.findUnique({ where: { id: targetScheduleId } })
    await prisma.massSchedule.update({
      where: { id: targetScheduleId },
      data: {
        kind: suggestion.kind,
        dayOfWeek: suggestion.dayOfWeek,
        date: suggestion.date,
        startTime,
        note: suggestion.note,
        validFrom: suggestion.validFrom,
        validTo: suggestion.validTo,
        source: 'SUGGESTION',
        lastConfirmedAt: new Date(),
      },
    })
    await recordRevision({
      entity: 'MassSchedule',
      entityId: targetScheduleId,
      field: 'updated',
      oldValue: before ? JSON.stringify({ kind: before.kind, startTime: before.startTime }) : null,
      newValue: JSON.stringify({ kind: suggestion.kind, startTime }),
      changedByRef: String(reviewerId),
      source: 'SUGGESTION',
    })
  } else if (suggestion.changeType === 'DELETE') {
    const targetScheduleId = suggestion.targetScheduleId
    if (!targetScheduleId) throw new ValidationError('Sugestão incompleta: falta targetScheduleId.')
    const before = await prisma.massSchedule.findUnique({ where: { id: targetScheduleId } })
    await prisma.massSchedule.delete({ where: { id: targetScheduleId } })
    await recordRevision({
      entity: 'MassSchedule',
      entityId: targetScheduleId,
      field: 'deleted',
      oldValue: before ? JSON.stringify({ kind: before.kind, startTime: before.startTime }) : null,
      newValue: 'DELETED',
      changedByRef: String(reviewerId),
      source: 'SUGGESTION',
    })
  }

  const updated = await prisma.massScheduleSuggestion.update({
    where: { id: suggestionId },
    data: { status: 'APPLY', reviewedById: reviewerId, reviewedAt: new Date() },
  })

  return { data: toDto(updated) }
}

export async function rejectMassScheduleSuggestion(
  suggestionId: number,
  reviewerId: number,
  reason?: string,
) {
  const suggestion = await prisma.massScheduleSuggestion.findUnique({
    where: { id: suggestionId },
  })
  if (!suggestion) throw new NotFoundError(`Sugestão ${suggestionId} não encontrada.`)
  if (suggestion.status === 'APPLY') throw new ValidationError('Sugestão já aplicada.')
  if (suggestion.status === 'REJECTED') throw new ValidationError('Sugestão já rejeitada.')

  const updated = await prisma.massScheduleSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason ?? null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  })

  return { data: toDto(updated) }
}

/** Retorna o churchId da sugestão (para checar permissão antes de aprovar/rejeitar). */
export async function getMSSuggestionChurchId(suggestionId: number): Promise<number> {
  const s = await prisma.massScheduleSuggestion.findUnique({
    where: { id: suggestionId },
    select: { churchId: true },
  })
  if (!s) throw new NotFoundError(`Sugestão ${suggestionId} não encontrada.`)
  return s.churchId
}
