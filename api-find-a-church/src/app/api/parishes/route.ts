import { route, ok, parseQuery } from '@/lib/http'
import { listParishesQuerySchema } from '@/modules/parish/schema'
import { listParishes } from '@/modules/parish/service'

export const GET = route(async (req: Request) => {
  const query = parseQuery(req, listParishesQuerySchema)
  const result = await listParishes(query)
  return ok(result.data, result.meta)
})
