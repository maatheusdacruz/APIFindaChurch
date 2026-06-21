import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requireDirectEditor } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/errors'
import { recordRevision } from '@/modules/revision/repository'

const params = z.object({
  id: z.coerce.number().int().positive(),
  scheduleId: z.coerce.number().int().positive(),
})

const updateScheduleBody = z.object({
  kind: z.enum(['MISSA', 'CONFISSAO', 'ADORACAO']).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  date: z.string().optional().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM').optional(),
  note: z.string().max(500).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
})

async function getSchedule(churchId: number, scheduleId: number) {
  const schedule = await prisma.massSchedule.findFirst({
    where: { id: scheduleId, churchId },
  })
  if (!schedule) throw new NotFoundError(`Horário ${scheduleId} não encontrado nesta igreja.`)
  return schedule
}

export const PUT = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id, scheduleId } = parseParams(await ctx.params, params)
  const { userId } = await requireDirectEditor(req, id)

  const before = await getSchedule(id, scheduleId)
  const body = await parseBody(req, updateScheduleBody)

  const updated = await prisma.massSchedule.update({
    where: { id: scheduleId },
    data: {
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
      ...(body.date !== undefined ? { date: body.date ? new Date(body.date) : null } : {}),
      ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.validFrom !== undefined ? { validFrom: body.validFrom ? new Date(body.validFrom) : null } : {}),
      ...(body.validTo !== undefined ? { validTo: body.validTo ? new Date(body.validTo) : null } : {}),
      source: 'ADMIN',
      lastConfirmedAt: new Date(),
    },
  })

  await recordRevision({
    entity: 'MassSchedule',
    entityId: scheduleId,
    field: 'updated',
    oldValue: JSON.stringify({ kind: before.kind, startTime: before.startTime }),
    newValue: JSON.stringify({ kind: updated.kind, startTime: updated.startTime }),
    changedByRef: String(userId),
    source: 'ADMIN',
  })

  return ok({
    id: updated.id,
    kind: updated.kind,
    dayOfWeek: updated.dayOfWeek,
    date: updated.date ? updated.date.toISOString().slice(0, 10) : null,
    startTime: updated.startTime,
    note: updated.note,
    validFrom: updated.validFrom?.toISOString() ?? null,
    validTo: updated.validTo?.toISOString() ?? null,
  })
})

export const DELETE = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id, scheduleId } = parseParams(await ctx.params, params)
  const { userId } = await requireDirectEditor(req, id)

  const before = await getSchedule(id, scheduleId)

  await prisma.massSchedule.delete({ where: { id: scheduleId } })

  await recordRevision({
    entity: 'MassSchedule',
    entityId: scheduleId,
    field: 'deleted',
    oldValue: JSON.stringify({ kind: before.kind, startTime: before.startTime }),
    newValue: 'DELETED',
    changedByRef: String(userId),
    source: 'ADMIN',
  })

  return ok({ id: scheduleId, deleted: true })
})
