import { route, ok, parseParams, parseQuery } from '@/lib/http'
import { churchIdParamSchema, revisionQuerySchema } from '@/modules/revision/schema'
import { getChurchRevisions } from '@/modules/revision/service'

export const GET = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  const query = parseQuery(req, revisionQuerySchema)
  const result = await getChurchRevisions(id, query)
  return ok(result.data, result.meta)
})
