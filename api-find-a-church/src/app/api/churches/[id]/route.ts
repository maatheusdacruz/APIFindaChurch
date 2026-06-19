import type { NextRequest } from 'next/server'
import { route, ok, parseQuery, parseParams } from '@/lib/http'
import { idParamSchema, profileQuerySchema } from '@/modules/church/schema'
import { getProfile } from '@/modules/church/service'

// GET /api/churches/:id — perfil completo (horários, atributos, frescor, distância).
export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = parseParams(await ctx.params, idParamSchema)
  const geo = parseQuery(req, profileQuerySchema)
  const { data } = await getProfile(id, geo)
  return ok(data)
})
