import { route, ok } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { listAdminParishes } from '@/modules/admin/service'

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const result = await listAdminParishes()
  return ok(result.data)
})
