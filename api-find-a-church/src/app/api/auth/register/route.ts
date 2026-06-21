import { route, created, parseBody } from '@/lib/http'
import { registerBodySchema } from '@/modules/auth/schema'
import { registerUser } from '@/modules/auth/service'

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, registerBodySchema)
  const result = await registerUser(body)
  return created(result.data)
})
