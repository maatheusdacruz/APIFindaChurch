import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { env } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { feedbackBodySchema } from './schema'
import { createSuggestion } from '@/modules/suggestion/repository'

export async function submitFeedback(massId: number, body: z.infer<typeof feedbackBodySchema>) {
  const ms = await prisma.massSchedule.findUnique({ where: { id: massId } })
  if (!ms) throw new NotFoundError(`Horário ${massId} não encontrado.`)

  const feedback = await prisma.feedback.create({
    data: {
      targetType: 'MassSchedule',
      targetId: massId,
      value: body.value,
      deviceRef: body.deviceRef ?? null,
    },
  })

  let freshnessUpdated = false

  if (body.value === 'CONFIRM') {
    // CONFIRM: atualiza lastConfirmedAt e aumenta a confiança.
    const newConfidence = Math.min(1, ms.confidence + 0.05)
    await prisma.massSchedule.update({
      where: { id: massId },
      data: {
        lastConfirmedAt: new Date(),
        confidence: newConfidence,
        source: 'USER_FEEDBACK',
      },
    })
    freshnessUpdated = true
  } else {
    // DENY: reduz confiança. Se acúmulo excede o limiar, abre sugestão de revisão.
    const newConfidence = Math.max(0, ms.confidence - 0.1)
    await prisma.massSchedule.update({
      where: { id: massId },
      data: { confidence: newConfidence },
    })
    freshnessUpdated = true

    // Conta quantos DENY acumulados nas últimas 24h.
    const recentDenies = await prisma.feedback.count({
      where: {
        targetType: 'MassSchedule',
        targetId: massId,
        value: 'DENY',
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    })

    if (recentDenies >= env.FEEDBACK_DENY_THRESHOLD) {
      // Abre uma sugestão automática de revisão para operador humano.
      await createSuggestion({
        targetType: 'MassSchedule',
        targetId: massId,
        field: 'startTime',
        currentValue: ms.startTime,
        proposedValue: ms.startTime,
        riskTier: 'HIGH',
        status: 'IN_REVIEW',
        source: 'APP',
        submittedByRef: null,
        confidence: newConfidence,
        notes: `Auto-aberta: ${recentDenies} DENY nas últimas 24h.`,
      })
    }
  }

  return {
    data: {
      id: feedback.id,
      targetType: feedback.targetType,
      targetId: feedback.targetId,
      value: feedback.value,
      deviceRef: feedback.deviceRef,
      createdAt: feedback.createdAt.toISOString(),
      freshnessUpdated,
    },
  }
}
