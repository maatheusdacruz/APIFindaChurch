import { NextResponse } from 'next/server'
import { route, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { postIdParamSchema } from '@/modules/mural/schema'
import { deleteMuralPost } from '@/modules/mural/service'

export const DELETE = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id, postId } = parseParams(await ctx.params, postIdParamSchema)
  await deleteMuralPost(userId, id, postId)
  return new NextResponse(null, { status: 204 })
})
