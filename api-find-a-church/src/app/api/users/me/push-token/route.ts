import { route, ok, parseBody } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { pushTokenBodySchema } from '@/modules/user/schema'
import { savePushToken } from '@/modules/user/service'

export const PUT = route(async (req: Request) => {
  const { userId } = requireAuth(req)
  const body = await parseBody(req, pushTokenBodySchema)
  const result = await savePushToken(userId, body)
  return ok(result.data)
})
