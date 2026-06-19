import type { NextRequest } from 'next/server'
import { route, ok, parseQuery } from '@/lib/http'
import { massNowQuerySchema } from '@/modules/mass/schema'
import { massNow } from '@/modules/mass/service'

// GET /api/mass/now — Missa Agora (RF09): missas começando dentro da janela, perto.
export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, massNowQuerySchema)
  const { data, meta } = await massNow(query)
  return ok(data, meta)
})
