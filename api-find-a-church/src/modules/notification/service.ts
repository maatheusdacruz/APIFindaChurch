import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { nextOccurrence } from '@/lib/time'
import { scheduleReminderBodySchema } from './schema'

export async function scheduleReminders(userId: number, body: z.infer<typeof scheduleReminderBodySchema>) {
  const [church, massSchedule] = await Promise.all([
    prisma.church.findUnique({ where: { id: body.churchId } }),
    prisma.massSchedule.findUnique({ where: { id: body.massScheduleId } }),
  ])

  if (!church) throw new NotFoundError(`Igreja ${body.churchId} não encontrada.`)
  if (!massSchedule) throw new NotFoundError(`Horário ${body.massScheduleId} não encontrado.`)

  const nextAt = nextOccurrence(massSchedule, new Date())
  if (!nextAt) throw new NotFoundError('Nenhuma próxima ocorrência encontrada para este horário.')

  const payload = {
    churchId: body.churchId,
    churchName: church.name,
    massScheduleId: body.massScheduleId,
    startTime: massSchedule.startTime,
    nextAt: nextAt.toISOString(),
    actions: ['Visitar', 'Compartilhar'],
  }

  const reminders = await Promise.all(
    body.offsetMinutes.map(async (offset) => {
      const fireAt = new Date(nextAt.getTime() - offset * 60_000)
      const notification = await prisma.scheduledNotification.create({
        data: {
          userId,
          churchId: body.churchId,
          massScheduleId: body.massScheduleId,
          kind: 'MASS_REMINDER',
          fireAt,
          status: 'PENDING',
          payload,
        },
      })
      return {
        id: notification.id,
        kind: notification.kind,
        fireAt: notification.fireAt.toISOString(),
        offsetMinutes: offset,
        status: notification.status,
      }
    }),
  )

  return { data: { reminders } }
}
