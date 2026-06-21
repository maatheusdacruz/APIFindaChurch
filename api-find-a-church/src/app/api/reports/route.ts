import { route, created, parseBody } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { createReportBodySchema } from '@/modules/report/schema'
import { createReport } from '@/modules/report/service'

export const POST = route(async (req: Request) => {
  requireAuth(req)
  const body = await parseBody(req, createReportBodySchema)
  const result = await createReport(body)
  return created(result.data)
})
