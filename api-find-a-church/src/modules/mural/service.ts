import { z } from 'zod'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { createMuralPostBodySchema, muralQuerySchema, muralPostSchema } from './schema'

function toDto(p: { id: number; churchId: number; type: string; content: string; authorId: number; createdAt: Date; updatedAt: Date }): z.infer<typeof muralPostSchema> {
  return {
    id: p.id,
    churchId: p.churchId,
    type: p.type as z.infer<typeof muralPostSchema>['type'],
    content: p.content,
    authorId: p.authorId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

export async function listMuralPosts(churchId: number, query: z.infer<typeof muralQuerySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const [rows, total] = await Promise.all([
    prisma.muralPost.findMany({
      where: { churchId },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.muralPost.count({ where: { churchId } }),
  ])

  return { data: rows.map(toDto), meta: { page: query.page, pageSize: query.pageSize, total } }
}

export async function createMuralPost(userId: number, churchId: number, body: z.infer<typeof createMuralPostBodySchema>) {
  const church = await prisma.church.findUnique({ where: { id: churchId } })
  if (!church) throw new NotFoundError(`Igreja ${churchId} não encontrada.`)

  const guardian = await prisma.guardianRole.findFirst({
    where: { userId, churchId, status: 'ACTIVE' },
  })
  if (!guardian) throw new ForbiddenError('Apenas o guardião ativo da igreja pode publicar no mural.')

  const post = await prisma.muralPost.create({
    data: { churchId, type: body.type, content: body.content, authorId: userId },
  })

  return { data: toDto(post) }
}

export async function deleteMuralPost(userId: number, churchId: number, postId: number) {
  const post = await prisma.muralPost.findUnique({ where: { id: postId } })
  if (!post || post.churchId !== churchId) throw new NotFoundError('Post não encontrado.')

  const guardian = await prisma.guardianRole.findFirst({
    where: { userId, churchId, status: 'ACTIVE' },
  })

  if (post.authorId !== userId && !guardian) {
    throw new ForbiddenError('Apenas o autor ou o guardião podem remover este post.')
  }

  await prisma.muralPost.delete({ where: { id: postId } })
}
