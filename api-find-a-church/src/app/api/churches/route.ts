import type { NextRequest } from 'next/server'
import { route, ok, parseQuery } from '@/lib/http'
import { listQuerySchema } from '@/modules/church/schema'
import { searchChurches } from '@/modules/church/service'

// GET /api/churches — lista/busca por tipo, bbox, nome (RF06).
export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, listQuerySchema)
  const { data, meta } = await searchChurches(query)
  return ok(data, meta)
})
