import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requireScheduleApprover } from '@/lib/auth'
import { msSuggestionIdParamSchema, rejectMSSuggestionBodySchema } from '@/modules/massScheduleSuggestion/schema'
import { rejectMassScheduleSuggestion, getMSSuggestionChurchId } from '@/modules/massScheduleSuggestion/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, msSuggestionIdParamSchema)
  const churchId = await getMSSuggestionChurchId(id)
  const { userId } = await requireScheduleApprover(req, churchId)
  const body = await parseBody(req, rejectMSSuggestionBodySchema)
  const result = await rejectMassScheduleSuggestion(id, userId, body.reason)
  return ok(result.data)
})
