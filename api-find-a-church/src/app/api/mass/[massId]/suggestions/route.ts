import { route, created, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { massIdParamSchema, createSuggestionBodySchema } from '@/modules/suggestion/schema'
import { suggestMassScheduleField } from '@/modules/suggestion/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  requireAuth(req)
  const { massId } = parseParams(await ctx.params, massIdParamSchema)
  const body = await parseBody(req, createSuggestionBodySchema)
  const result = await suggestMassScheduleField(massId, body)
  return created(result.data)
})
