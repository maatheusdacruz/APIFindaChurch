import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { updateGuardianStatus } from '@/modules/admin/service'
import { z } from 'zod'

const params = z.object({ id: z.coerce.number().int().positive() })
const body = z.object({ status: z.enum(['ACTIVE', 'FROZEN', 'REMOVED']) })

export const PUT = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  await requirePlatformAdmin(req)
  const { id } = parseParams(await ctx.params, params)
  const { status } = await parseBody(req, body)
  const result = await updateGuardianStatus(id, status)
  return ok(result.data)
})
