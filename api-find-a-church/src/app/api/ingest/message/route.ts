import { route, created, parseBody } from '@/lib/http'
import { ingestMessageBodySchema } from '@/modules/enrichment/schema'
import { ingestMessage } from '@/modules/enrichment/service'

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, ingestMessageBodySchema)
  const result = await ingestMessage(body)
  return created(result.data)
})
