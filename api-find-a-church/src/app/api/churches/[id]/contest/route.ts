import { route, ok, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { contestBodySchema } from '@/modules/guardian/schema'
import { contestChurchParish } from '@/modules/guardian/service'
import { z } from 'zod'

const idParam = z.object({ id: z.coerce.number().int().positive() })

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id } = parseParams(await ctx.params, idParam)
  const body = await parseBody(req, contestBodySchema)
  const result = await contestChurchParish(userId, id, body)
  return ok(result.data)
})
