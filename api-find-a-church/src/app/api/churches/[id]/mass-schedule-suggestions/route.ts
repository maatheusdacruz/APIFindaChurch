import { route, ok, created, parseBody, parseParams, parseQuery } from '@/lib/http'
import { requireAuth, requireScheduleApprover } from '@/lib/auth'
import { extractToken } from '@/lib/auth'
import { churchIdParamSchema, createMSSuggestionBodySchema, listMSSuggestionsQuerySchema } from '@/modules/massScheduleSuggestion/schema'
import { createMassScheduleSuggestion, listMassScheduleSuggestions } from '@/modules/massScheduleSuggestion/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const payload = extractToken(req)
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  const body = await parseBody(req, createMSSuggestionBodySchema)
  const result = await createMassScheduleSuggestion(id, body, payload?.userId ?? null)
  return created(result.data)
})

export const GET = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, churchIdParamSchema)
  // Listagem requer permissão (guardião, admin paróquia ou platform admin)
  await requireScheduleApprover(req, id)
  const query = parseQuery(req, listMSSuggestionsQuerySchema)
  const result = await listMassScheduleSuggestions(id, query)
  return ok(result.data, result.meta)
})
