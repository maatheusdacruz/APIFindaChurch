import { route, ok, parseParams, parseBody } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { resolveParishContest } from '@/modules/admin/unifiedSuggestions'
import { z } from 'zod'

const params = z.object({
  churchId: z.coerce.number().int().positive(),
  parishId: z.coerce.number().int().positive(),
})
const bodySchema = z.object({ approve: z.boolean() })

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  await requirePlatformAdmin(req)
  const { churchId, parishId } = parseParams(await ctx.params, params)
  const { approve } = await parseBody(req, bodySchema)
  await resolveParishContest(churchId, parishId, approve)
  return ok({ churchId, parishId, resolved: true })
})
