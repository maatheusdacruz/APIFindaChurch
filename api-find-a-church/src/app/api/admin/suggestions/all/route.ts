import { route, ok, parseQuery } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { listUnifiedSuggestions } from '@/modules/admin/unifiedSuggestions'
import { z } from 'zod'

const query = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPLIED', 'REJECTED', 'ALL']).default('PENDING'),
  type: z.enum(['ALL', 'INFO', 'SCHEDULE', 'GUARDIAN', 'PARISH']).default('ALL'),
})

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const { status, type } = parseQuery(req, query)
  const data = await listUnifiedSuggestions(status as any, type as any)
  return ok(data)
})
