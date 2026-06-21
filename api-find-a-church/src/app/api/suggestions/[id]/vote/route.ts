import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { voteBodySchema, suggestionIdParamSchema } from '@/modules/consensus/schema'
import { voteOnSuggestion } from '@/modules/consensus/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id } = parseParams(await ctx.params, suggestionIdParamSchema)
  const body = await parseBody(req, voteBodySchema)
  const result = await voteOnSuggestion(userId, id, body)
  return ok(result.data)
})
