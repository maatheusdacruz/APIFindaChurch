import { route, created, parseBody } from '@/lib/http'
import { ingestEnrichmentBodySchema } from '@/modules/enrichment/schema'
import { ingestEnrichment } from '@/modules/enrichment/service'

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, ingestEnrichmentBodySchema)
  const result = await ingestEnrichment(body)
  return created(result.data)
})
