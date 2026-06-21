import { route, created, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { massIdParamSchema, feedbackBodySchema } from '@/modules/feedback/schema'
import { submitFeedback } from '@/modules/feedback/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  requireAuth(req)
  const { massId } = parseParams(await ctx.params, massIdParamSchema)
  const body = await parseBody(req, feedbackBodySchema)
  const result = await submitFeedback(massId, body)
  return created(result.data)
})
