import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { route, ok, created, parseQuery, parseBody } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { listQuerySchema, CHURCH_TYPES } from '@/modules/church/schema'
import { searchChurches, createChurch } from '@/modules/church/service'

// GET /api/churches — lista/busca por tipo, bbox, nome (RF06).
export const GET = route(async (req: NextRequest) => {
  const query = parseQuery(req, listQuerySchema)
  const { data, meta } = await searchChurches(query)
  return ok(data, meta)
})

const createBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(CHURCH_TYPES).default('IGREJA'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressLine: z.string().trim().optional(),
  district: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2).transform((s) => s.toUpperCase()).optional(),
  postalCode: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  photoUrl: z.string().url().optional(),
})

// POST /api/churches — cria uma nova igreja (qualquer usuário autenticado).
export const POST = route(async (req: Request) => {
  const { userId } = requireAuth(req)
  const body = await parseBody(req, createBodySchema)
  const result = await createChurch(body, userId)
  return created(result.data)
})
