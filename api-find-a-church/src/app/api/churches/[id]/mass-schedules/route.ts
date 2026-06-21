import { route, created, parseBody, parseParams } from '@/lib/http'
import { requireDirectEditor } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/errors'
import { recordRevision } from '@/modules/revision/repository'

const churchIdParam = z.object({ id: z.coerce.number().int().positive() })

const createScheduleBody = z.object({
  kind: z.enum(['MISSA', 'CONFISSAO', 'ADORACAO']).default('MISSA'),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  date: z.string().optional().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  note: z.string().max(500).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
})

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, churchIdParam)
  const { userId } = await requireDirectEditor(req, id)

  const church = await prisma.church.findUnique({ where: { id } })
  if (!church) throw new NotFoundError(`Igreja ${id} não encontrada.`)

  const body = await parseBody(req, createScheduleBody)

  const schedule = await prisma.massSchedule.create({
    data: {
      churchId: id,
      kind: body.kind,
      dayOfWeek: body.dayOfWeek ?? null,
      date: body.date ? new Date(body.date) : null,
      startTime: body.startTime,
      note: body.note ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
      source: 'ADMIN',
      lastConfirmedAt: new Date(),
    },
  })

  await recordRevision({
    entity: 'MassSchedule',
    entityId: schedule.id,
    field: 'created',
    oldValue: null,
    newValue: JSON.stringify({ kind: body.kind, startTime: body.startTime }),
    changedByRef: String(userId),
    source: 'ADMIN',
  })

  return created({
    id: schedule.id,
    kind: schedule.kind,
    dayOfWeek: schedule.dayOfWeek,
    date: schedule.date ? schedule.date.toISOString().slice(0, 10) : null,
    startTime: schedule.startTime,
    note: schedule.note,
    validFrom: schedule.validFrom?.toISOString() ?? null,
    validTo: schedule.validTo?.toISOString() ?? null,
  })
})
