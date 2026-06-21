import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { addChurchesToParishBodySchema, parishIdParamSchema } from '@/modules/parish/schema'
import { addChurchesToParish } from '@/modules/parish/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id } = parseParams(await ctx.params, parishIdParamSchema)
  const body = await parseBody(req, addChurchesToParishBodySchema)
  const result = await addChurchesToParish(userId, id, body)
  return ok(result.data)
})
