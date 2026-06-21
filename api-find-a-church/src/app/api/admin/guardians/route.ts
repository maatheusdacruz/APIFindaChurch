import { route, ok, parseQuery } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { listAdminGuardians } from '@/modules/admin/service'
import { z } from 'zod'

const query = z.object({
  status: z.enum(['ACTIVE', 'FROZEN', 'REMOVED']).optional(),
})

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const { status } = parseQuery(req, query)
  const result = await listAdminGuardians(status)
  return ok(result.data)
})
