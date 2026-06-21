import { route, ok } from '@/lib/http'
import { getCoverageReport } from '@/modules/enrichment/service'

export const GET = route(async () => {
  const result = await getCoverageReport()
  return ok(result.data)
})
