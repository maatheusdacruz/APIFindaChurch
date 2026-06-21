import { route, ok, created, parseBody, parseParams, parseQuery } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { churchIdParamSchema, createMuralPostBodySchema, muralQuerySchema } from '@/modules/mural/schema'
import { listMuralPosts, createMuralPost } from '@/modules/mural/service'

export const GET = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  const query = parseQuery(req, muralQuerySchema)
  const result = await listMuralPosts(id, query)
  return ok(result.data, result.meta)
})

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  const body = await parseBody(req, createMuralPostBodySchema)
  const result = await createMuralPost(userId, id, body)
  return created(result.data)
})
