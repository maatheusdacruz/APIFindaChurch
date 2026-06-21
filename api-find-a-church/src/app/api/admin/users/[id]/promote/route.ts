import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { setUserPlatformAdmin } from '@/modules/admin/service'
import { z } from 'zod'

const params = z.object({ id: z.coerce.number().int().positive() })
const body = z.object({ isPlatformAdmin: z.boolean() })

export const PUT = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  await requirePlatformAdmin(req)
  const { id } = parseParams(await ctx.params, params)
  const { isPlatformAdmin } = await parseBody(req, body)
  const result = await setUserPlatformAdmin(id, isPlatformAdmin)
  return ok(result.data)
})
