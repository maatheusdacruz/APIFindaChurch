import { route, ok, parseParams } from '@/lib/http'
import { requireScheduleApprover } from '@/lib/auth'
import { msSuggestionIdParamSchema } from '@/modules/massScheduleSuggestion/schema'
import { approveMassScheduleSuggestion, getMSSuggestionChurchId } from '@/modules/massScheduleSuggestion/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, msSuggestionIdParamSchema)
  const churchId = await getMSSuggestionChurchId(id)
  const { userId } = await requireScheduleApprover(req, churchId)
  const result = await approveMassScheduleSuggestion(id, userId)
  return ok(result.data)
})
