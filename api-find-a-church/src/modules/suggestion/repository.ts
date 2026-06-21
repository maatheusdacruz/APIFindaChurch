import { type SuggestionStatus, type RiskTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function createSuggestion(data: {
  targetType: string
  targetId: number
  field: string
  currentValue: string | null
  proposedValue: string
  riskTier: RiskTier
  status: SuggestionStatus
  source: string
  submittedByRef: string | null
  confidence: number
  notes: string | null
}) {
  return prisma.suggestion.create({ data: data as Parameters<typeof prisma.suggestion.create>[0]['data'] })
}

export async function getSuggestionById(id: number) {
  return prisma.suggestion.findUnique({ where: { id } })
}

export async function listSuggestions(filter: {
  targetType: string
  targetId: number
  status?: SuggestionStatus
  page: number
  pageSize: number
}) {
  const where = {
    targetType: filter.targetType,
    targetId: filter.targetId,
    ...(filter.status ? { status: filter.status } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.suggestion.count({ where }),
  ])
  return { rows, total }
}

export async function updateSuggestionStatus(id: number, status: SuggestionStatus) {
  return prisma.suggestion.update({ where: { id }, data: { status } })
}
