import { route, created, parseBody } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { claimParishBodySchema } from '@/modules/parish/schema'
import { claimParish } from '@/modules/parish/service'

export const POST = route(async (req: Request) => {
  const { userId } = requireAuth(req)
  const body = await parseBody(req, claimParishBodySchema)
  const result = await claimParish(userId, body)
  return created(result.data)
})
