import { z } from 'zod'
import { ConflictError, NotFoundError } from '@/lib/errors'
import { env } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { recordRevision } from '@/modules/revision/repository'
import { voteBodySchema } from './schema'

export async function voteOnSuggestion(userId: number, suggestionId: number, body: z.infer<typeof voteBodySchema>) {
  const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } })
  if (!suggestion) throw new NotFoundError(`Sugestão ${suggestionId} não encontrada.`)
  if (suggestion.status !== 'PENDING' && suggestion.status !== 'IN_REVIEW') {
    throw new ConflictError('Sugestão não está em estado votável.')
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError('Usuário não encontrado.')

  // Upsert do ConsensusState para esta sugestão.
  let state = await prisma.consensusState.findUnique({ where: { suggestionId } })
  if (!state) {
    state = await prisma.consensusState.create({
      data: {
        suggestionId,
        outcome: 'PENDING',
        totalWeight: 0,
        threshold: env.CONSENSUS_THRESHOLD,
      },
    })
  }

  // Verifica duplicidade de voto.
  const existingVote = await prisma.consensusVote.findUnique({
    where: { consensusStateId_voterId: { consensusStateId: state.id, voterId: userId } },
  })
  if (existingVote) throw new ConflictError('Você já votou nesta sugestão.')

  // Peso = reputação do usuário. Admin verificado = peso máximo (10).
  const adminRole = await prisma.adminRole.findFirst({
    where: { userId, validationLevel: 'VERIFIED', status: 'ACTIVE' },
  })
  const weight = adminRole ? 10 : user.reputation

  await prisma.consensusVote.create({
    data: {
      consensusStateId: state.id,
      suggestionId,
      voterId: userId,
      approve: body.approve,
      weight,
    },
  })

  // Recalcula peso total de votos aprovadores.
  const votes = await prisma.consensusVote.findMany({ where: { consensusStateId: state.id } })
  const approveWeight = votes.filter((v) => v.approve).reduce((acc, v) => acc + v.weight, 0)
  const rejectWeight = votes.filter((v) => !v.approve).reduce((acc, v) => acc + v.weight, 0)

  let outcome: 'PENDING' | 'APPLIED' | 'REJECTED' = 'PENDING'

  if (approveWeight >= state.threshold) {
    outcome = 'APPLIED'
    // Aplica a sugestão.
    await applyApprovedSuggestion(suggestion)
  } else if (rejectWeight >= state.threshold) {
    outcome = 'REJECTED'
    await prisma.suggestion.update({ where: { id: suggestionId }, data: { status: 'REJECTED' } })
  }

  if (outcome !== 'PENDING') {
    await prisma.consensusState.update({
      where: { id: state.id },
      data: { outcome, totalWeight: approveWeight },
    })
  } else {
    await prisma.consensusState.update({
      where: { id: state.id },
      data: { totalWeight: approveWeight },
    })
  }

  return {
    data: {
      suggestionId,
      outcome,
      totalWeight: approveWeight,
      threshold: state.threshold,
      myVote: body.approve,
    },
  }
}

async function applyApprovedSuggestion(suggestion: { id: number; targetType: string; targetId: number; field: string; currentValue: string | null; proposedValue: string; submittedByRef: string | null }) {
  if (suggestion.targetType === 'Church') {
    await prisma.church.update({
      where: { id: suggestion.targetId },
      data: { [suggestion.field]: suggestion.proposedValue },
    })
  } else if (suggestion.targetType === 'MassSchedule') {
    await prisma.massSchedule.update({
      where: { id: suggestion.targetId },
      data: { [suggestion.field]: suggestion.proposedValue },
    })
  }

  await prisma.suggestion.update({ where: { id: suggestion.id }, data: { status: 'APPLIED' } })

  await recordRevision({
    entity: suggestion.targetType,
    entityId: suggestion.targetId,
    field: suggestion.field,
    oldValue: suggestion.currentValue,
    newValue: suggestion.proposedValue,
    changedByRef: 'consensus',
    source: 'SUGGESTION',
    suggestionId: suggestion.id,
  })
}
