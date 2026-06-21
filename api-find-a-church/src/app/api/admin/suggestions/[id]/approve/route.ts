import { route, ok, parseParams } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { approveSuggestion } from '@/modules/admin/service'
import { z } from 'zod'

const params = z.object({ id: z.coerce.number().int().positive() })

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  await requirePlatformAdmin(req)
  const { id } = parseParams(await ctx.params, params)
  const result = await approveSuggestion(id)
  return ok(result.data)
})
