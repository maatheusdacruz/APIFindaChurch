import type { NextRequest } from 'next/server'
import { route, ok, parseQuery } from '@/lib/http'
import { nearQuerySchema } from '@/modules/church/schema'
import { searchNearby } from '@/modules/church/service'

// GET /api/churches/near — proximidade por raio, ordenado por distância (PostGIS).
export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, nearQuerySchema)
  const { data, meta } = await searchNearby(query)
  return ok(data, meta)
})
