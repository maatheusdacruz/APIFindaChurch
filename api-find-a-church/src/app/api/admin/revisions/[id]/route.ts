import { route, created, parseParams } from '@/lib/http'
import { requireAdminKey } from '@/lib/auth'
import { revisionIdParamSchema } from '@/modules/revision/schema'
import { revertRevision } from '@/modules/revision/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  requireAdminKey(req)
  const { id } = parseParams(await ctx.params, revisionIdParamSchema)
  const result = await revertRevision(id)
  return created(result.data)
})
