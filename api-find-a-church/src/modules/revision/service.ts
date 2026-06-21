import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { listRevisions, getRevisionById, recordRevision } from './repository'
import { revisionSchema, revisionQuerySchema } from './schema'

function toDto(r: NonNullable<Awaited<ReturnType<typeof getRevisionById>>>): z.infer<typeof revisionSchema> {
  return {
    id: r.id,
    entity: r.entity,
    entityId: r.entityId,
    field: r.field,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedByRef: r.changedByRef,
    source: r.source,
    reversibleOf: r.reversibleOf,
    suggestionId: r.suggestionId,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function getChurchRevisions(churchId: number, query: z.infer<typeof revisionQuerySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const { rows, total } = await listRevisions('Church', churchId, query.page, query.pageSize)
  return {
    data: rows.map(toDto),
    meta: { page: query.page, pageSize: query.pageSize, total },
  }
}

export async function revertRevision(revisionId: number) {
  const rev = await getRevisionById(revisionId)
  if (!rev) throw new NotFoundError(`Revisão ${revisionId} não encontrada.`)

  // Aplica o valor antigo de volta à entidade.
  if (rev.entity === 'Church' && rev.oldValue !== null) {
    await prisma.church.update({
      where: { id: rev.entityId },
      data: { [rev.field]: rev.oldValue },
    })
  } else if (rev.entity === 'MassSchedule' && rev.oldValue !== null) {
    await prisma.massSchedule.update({
      where: { id: rev.entityId },
      data: { [rev.field]: rev.oldValue },
    })
  }

  const revertRev = await recordRevision({
    entity: rev.entity,
    entityId: rev.entityId,
    field: rev.field,
    oldValue: rev.newValue,
    newValue: rev.oldValue ?? '',
    changedByRef: 'admin',
    source: 'ADMIN',
    reversibleOf: revisionId,
  })

  return { data: toDto(revertRev) }
}
