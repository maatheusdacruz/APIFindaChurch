import { route, ok, parseQuery } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { favoritesQuerySchema } from '@/modules/favorite/schema'
import { listFavorites } from '@/modules/favorite/service'

export const GET = route(async (req: Request) => {
  const { userId } = requireAuth(req)
  const query = parseQuery(req, favoritesQuerySchema)
  const result = await listFavorites(userId, query)
  return ok(result.data, result.meta)
})
