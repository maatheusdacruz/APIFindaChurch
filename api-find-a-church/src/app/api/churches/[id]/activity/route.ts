import { route, ok, parseParams } from '@/lib/http'
import { getChurchActivity } from '@/modules/checkin/service'
import { z } from 'zod'

const idParam = z.object({ id: z.coerce.number().int().positive() })

export const GET = route(async (_req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { id } = parseParams(await ctx.params, idParam)
  const result = await getChurchActivity(id)
  return ok(result.data)
})
