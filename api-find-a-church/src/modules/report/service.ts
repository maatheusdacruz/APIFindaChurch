import { z } from 'zod'
import { env } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { createReportBodySchema } from './schema'

export async function createReport(body: z.infer<typeof createReportBodySchema>) {
  const report = await prisma.report.create({
    data: {
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      reporterRef: body.reporterRef ?? null,
    },
  })

  let autoFreezeTriggered = false

  // Conta denúncias contra este alvo e congela se exceder limiar (RN08).
  if (body.targetType === 'GuardianRole') {
    const reportCount = await prisma.report.count({
      where: { targetType: 'GuardianRole', targetId: body.targetId },
    })

    if (reportCount >= env.GUARDIAN_REPORT_FREEZE_THRESHOLD) {
      const guardian = await prisma.guardianRole.findUnique({ where: { id: body.targetId } })
      if (guardian && guardian.status === 'ACTIVE') {
        await prisma.guardianRole.update({
          where: { id: body.targetId },
          data: { status: 'FROZEN' },
        })
        autoFreezeTriggered = true

        // Promove o próximo frequentador mais confiável (RN09).
        await promoteNextGuardian(guardian.churchId, guardian.userId)
      }
    }
  }

  return {
    data: {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
      autoFreezeTriggered,
    },
  }
}

/** Promove o próximo guardião candidato após congelamento (RN09). */
async function promoteNextGuardian(churchId: number, frozenUserId: number) {
  // Candidato: usuário com mais check-ins nessa igreja (exceto o congelado).
  const topCheckin = await prisma.checkIn.groupBy({
    by: ['userId'],
    where: { churchId, userId: { not: frozenUserId } },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 1,
  })

  if (topCheckin.length === 0) return

  const candidateId = topCheckin[0].userId
  const user = await prisma.user.findUnique({ where: { id: candidateId } })
  if (!user || user.reputation < env.GUARDIAN_AUTO_CONFIDENCE) return

  await prisma.guardianRole.upsert({
    where: { userId_churchId: { userId: candidateId, churchId } },
    create: { userId: candidateId, churchId, status: 'ACTIVE', behavioralScore: user.reputation },
    update: { status: 'ACTIVE' },
  })
}
