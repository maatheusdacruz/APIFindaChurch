import { z } from 'zod'
import { route, created, parseBody } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { importOsmJson, type OsmRecord } from '@/modules/admin/service'

// Aceita array direto ou envelope com "elements", "data", "parishes" etc.
const osmRecordSchema = z.object({
  osm_id: z.union([z.number(), z.string()]),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  kind: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  photo_url: z.string().nullable().optional(),
  tags: z.record(z.string(), z.string()).optional(),
})

const envelopeKeys = ['elements', 'parishes', 'churches', 'data', 'items', 'results'] as const

const bodySchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input
  if (input && typeof input === 'object') {
    for (const key of envelopeKeys) {
      if (Array.isArray((input as Record<string, unknown>)[key])) {
        return (input as Record<string, unknown>)[key]
      }
    }
  }
  return []
}, z.array(osmRecordSchema))

export const POST = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const records = await parseBody(req, bodySchema)
  const result = await importOsmJson(records as OsmRecord[])
  return created(result.data)
})
