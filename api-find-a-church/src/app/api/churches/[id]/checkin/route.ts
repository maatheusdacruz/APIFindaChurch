import { route, created, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { checkInBodySchema } from '@/modules/checkin/schema'
import { registerCheckIn } from '@/modules/checkin/service'
import { z } from 'zod'

const idParam = z.object({ id: z.coerce.number().int().positive() })

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id } = parseParams(await ctx.params, idParam)
  const body = await parseBody(req, checkInBodySchema)
  const result = await registerCheckIn(userId, id, body)
  return created(result.data)
})
