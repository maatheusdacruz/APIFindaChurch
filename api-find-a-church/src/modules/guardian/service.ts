import { z } from 'zod'
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { claimGuardianBodySchema, contestBodySchema, guardianSchema } from './schema'

function toDto(g: { id: number; churchId: number; userId: number; status: string; behavioralScore: number; claimedAt: Date }): z.infer<typeof guardianSchema> {
  return {
    id: g.id,
    churchId: g.churchId,
    userId: g.userId,
    status: g.status as z.infer<typeof guardianSchema>['status'],
    behavioralScore: g.behavioralScore,
    claimedAt: g.claimedAt.toISOString(),
  }
}

export async function claimGuardian(userId: number, churchId: number, body: z.infer<typeof claimGuardianBodySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const existing = await prisma.guardianRole.findFirst({
    where: { churchId, status: 'ACTIVE' },
  })
  if (existing) throw new ConflictError('Esta igreja já possui um guardião ativo.')

  const guardian = await prisma.guardianRole.upsert({
    where: { userId_churchId: { userId, churchId } },
    create: { userId, churchId, status: 'ACTIVE', behavioralScore: 0.5 },
    update: { status: 'ACTIVE' },
  })

  return { data: toDto(guardian) }
}

export async function getGuardian(churchId: number) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const guardian = await prisma.guardianRole.findFirst({
    where: { churchId, status: 'ACTIVE' },
  })

  return { data: guardian ? toDto(guardian) : null }
}

export async function contestChurchParish(userId: number, churchId: number, body: z.infer<typeof contestBodySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const guardian = await prisma.guardianRole.findFirst({
    where: { userId, churchId, status: 'ACTIVE' },
  })
  if (!guardian) throw new ForbiddenError('Apenas o guardião ativo da igreja pode contestar.')

  const link = await prisma.churchParish.findUnique({
    where: { churchId_parishId: { churchId, parishId: body.parishId } },
  })
  if (!link) throw new NotFoundError('Vínculo igreja-paróquia não encontrado.')

  await prisma.churchParish.update({
    where: { churchId_parishId: { churchId, parishId: body.parishId } },
    data: { contested: true },
  })

  return { data: { churchId, parishId: body.parishId, contested: true } }
}
