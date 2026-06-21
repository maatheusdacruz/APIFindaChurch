import { route, ok } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { getMe } from '@/modules/auth/service'

export const GET = route(async (req: Request) => {
  const { userId } = requireAuth(req)
  const result = await getMe(userId)
  return ok(result.data)
})
