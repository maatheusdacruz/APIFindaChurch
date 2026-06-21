import { route, ok, parseQuery } from '@/lib/http'
import { travelQuerySchema } from '@/modules/discovery/schema'
import { discoverTravel } from '@/modules/discovery/service'

export const GET = route(async (req: Request) => {
  const query = parseQuery(req, travelQuerySchema)
  const result = await discoverTravel(query)
  return ok(result.data)
})
