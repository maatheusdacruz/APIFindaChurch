import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { env } from '@/config/env'
import { checkInBodySchema } from './schema'

export async function registerCheckIn(userId: number, churchId: number, body: z.infer<typeof checkInBodySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const checkIn = await prisma.checkIn.create({
    data: {
      userId,
      churchId,
      massScheduleId: body.massScheduleId ?? null,
    },
  })

  return {
    data: {
      id: checkIn.id,
      churchId: checkIn.churchId,
      massScheduleId: checkIn.massScheduleId,
      createdAt: checkIn.createdAt.toISOString(),
    },
  }
}

/** Agrega atividade sem expor identidades individuais (RNF03). */
export async function getChurchActivity(churchId: number) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const since = new Date(Date.now() - env.CHECKIN_ACTIVITY_DAYS * 86_400_000)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [checkIns, confirmedToday, lastCheckIn] = await Promise.all([
    prisma.checkIn.findMany({
      where: { churchId, createdAt: { gte: since } },
      select: { userId: true, createdAt: true },
    }),
    prisma.feedback.count({
      where: {
        targetType: 'MassSchedule',
        value: 'CONFIRM',
        createdAt: { gte: today },
        targetId: { in: await getMassScheduleIds(churchId) },
      },
    }),
    prisma.checkIn.findFirst({
      where: { churchId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  const uniqueVisitors = new Set(checkIns.map((c) => c.userId)).size

  return {
    data: {
      churchId,
      checkInsLast30Days: checkIns.length,
      uniqueVisitorsLast30Days: uniqueVisitors,
      lastActivityAt: lastCheckIn ? lastCheckIn.createdAt.toISOString() : null,
      confirmedTodayCount: confirmedToday,
    },
  }
}

async function getMassScheduleIds(churchId: number): Promise<number[]> {
  const schedules = await prisma.massSchedule.findMany({
    where: { churchId },
    select: { id: true },
  })
  return schedules.map((s) => s.id)
}
