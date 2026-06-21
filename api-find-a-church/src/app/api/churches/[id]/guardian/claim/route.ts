import { route, created, parseBody, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { claimGuardianBodySchema } from '@/modules/guardian/schema'
import { claimGuardian } from '@/modules/guardian/service'
import { z } from 'zod'

const idParam = z.object({ id: z.coerce.number().int().positive() })

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { id } = parseParams(await ctx.params, idParam)
  const body = await parseBody(req, claimGuardianBodySchema)
  const result = await claimGuardian(userId, id, body)
  return created(result.data)
})
