import { route, ok, created, parseBody } from '@/lib/http'
import { registerUserBodySchema } from '@/modules/user/schema'
import { registerOrLoginUser } from '@/modules/user/service'

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, registerUserBodySchema)
  const result = await registerOrLoginUser(body)
  return result.isNew ? created(result.data) : ok(result.data)
})
