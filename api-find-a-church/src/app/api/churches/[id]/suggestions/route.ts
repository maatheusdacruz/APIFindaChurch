import { route, ok, created, parseBody, parseParams, parseQuery } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { churchIdParamSchema, createSuggestionBodySchema, listSuggestionsQuerySchema } from '@/modules/suggestion/schema'
import { suggestChurchField, listChurchSuggestions } from '@/modules/suggestion/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  requireAuth(req)
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  const body = await parseBody(req, createSuggestionBodySchema)
  const result = await suggestChurchField(id, body)
  return created(result.data)
})

export const GET = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  const query = parseQuery(req, listSuggestionsQuerySchema)
  const result = await listChurchSuggestions(id, query)
  return ok(result.data, result.meta)
})
