import { route, ok, parseBody } from '@/lib/http'
import { loginBodySchema } from '@/modules/auth/schema'
import { loginUser } from '@/modules/auth/service'

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, loginBodySchema)
  const result = await loginUser(body)
  return ok(result.data)
})
