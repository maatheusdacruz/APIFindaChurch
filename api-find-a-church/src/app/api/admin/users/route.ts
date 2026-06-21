import { route, ok, parseQuery } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { listAdminUsers } from '@/modules/admin/service'
import { z } from 'zod'

const query = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const { page, pageSize } = parseQuery(req, query)
  const result = await listAdminUsers(page, pageSize)
  return ok(result.data, result.meta)
})
