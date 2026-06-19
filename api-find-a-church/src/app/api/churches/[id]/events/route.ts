import type { NextRequest } from 'next/server'
import { route, ok, parseQuery, parseParams } from '@/lib/http'
import { idParamSchema, eventsQuerySchema } from '@/modules/church/schema'
import { getEvents } from '@/modules/church/service'

// GET /api/churches/:id/events — próximos eventos (RF12).
export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = parseParams(await ctx.params, idParamSchema)
  const { page, pageSize } = parseQuery(req, eventsQuerySchema)
  const { data, meta } = await getEvents(id, page, pageSize)
  return ok(data, meta)
})
