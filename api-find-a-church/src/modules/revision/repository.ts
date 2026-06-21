import { type FreshnessSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function recordRevision(data: {
  entity: string
  entityId: number
  field: string
  oldValue: string | null
  newValue: string
  changedByRef: string | null
  source: FreshnessSource | string
  reversibleOf?: number
  suggestionId?: number
}) {
  return prisma.revision.create({
    data: {
      entity: data.entity,
      entityId: data.entityId,
      field: data.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
      changedByRef: data.changedByRef,
      source: data.source as FreshnessSource,
      reversibleOf: data.reversibleOf ?? null,
      suggestionId: data.suggestionId ?? null,
    },
  })
}

export async function getRevisionById(id: number) {
  return prisma.revision.findUnique({ where: { id } })
}

export async function listRevisions(entity: string, entityId: number, page: number, pageSize: number) {
  const where = { entity, entityId }
  const [rows, total] = await Promise.all([
    prisma.revision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.revision.count({ where }),
  ])
  return { rows, total }
}
