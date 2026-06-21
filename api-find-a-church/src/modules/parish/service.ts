import { z } from 'zod'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { claimParishBodySchema, addChurchesToParishBodySchema, listParishesQuerySchema, parishSchema } from './schema'

function toDto(p: { id: number; name: string; status: string; createdAt: Date; _count?: { churches: number } }): z.infer<typeof parishSchema> {
  return {
    id: p.id,
    name: p.name,
    status: p.status as z.infer<typeof parishSchema>['status'],
    churchCount: p._count?.churches ?? 0,
    createdAt: p.createdAt.toISOString(),
  }
}

export async function listParishes(query: z.infer<typeof listParishesQuerySchema>) {
  const [rows, total] = await Promise.all([
    prisma.parish.findMany({
      include: { _count: { select: { churches: true } } },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.parish.count(),
  ])
  return { data: rows.map(toDto), meta: { page: query.page, pageSize: query.pageSize, total } }
}

export async function claimParish(userId: number, body: z.infer<typeof claimParishBodySchema>) {
  const parish = await prisma.parish.create({
    data: {
      name: body.name,
      status: 'PROVISIONAL',
      claimedByAdminId: userId,
    },
    include: { _count: { select: { churches: true } } },
  })

  await prisma.adminRole.create({
    data: {
      userId,
      parishId: parish.id,
      validationLevel: 'PROVISIONAL',
      status: 'ACTIVE',
    },
  })

  return { data: toDto(parish) }
}

export async function addChurchesToParish(
  userId: number,
  parishId: number,
  body: z.infer<typeof addChurchesToParishBodySchema>,
) {
  const parish = await prisma.parish.findUnique({ where: { id: parishId } })
  if (!parish) throw new NotFoundError(`Paróquia ${parishId} não encontrada.`)

  const adminRole = await prisma.adminRole.findFirst({
    where: { userId, parishId, status: 'ACTIVE' },
  })
  if (!adminRole) throw new ForbiddenError('Papel de administrador de paróquia necessário.')

  let added = 0
  for (const churchId of body.churchIds) {
    const church = await prisma.church.findUnique({ where: { id: churchId } })
    if (!church) continue

    await prisma.churchParish.upsert({
      where: { churchId_parishId: { churchId, parishId } },
      create: { churchId, parishId },
      update: {},
    })
    added++
  }

  return { data: { added, parishId } }
}
