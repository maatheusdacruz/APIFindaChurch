import { route, ok, parseQuery } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { listAdminSuggestions } from '@/modules/admin/service'
import { z } from 'zod'

const query = z.object({
  status: z.enum(['PENDING', 'APPLIED', 'REJECTED', 'IN_REVIEW']).default('PENDING'),
})

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const { status } = parseQuery(req, query)
  const result = await listAdminSuggestions(status)
  return ok(result.data)
})
