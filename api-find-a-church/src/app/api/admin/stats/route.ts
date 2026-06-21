import { route, ok } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { getAdminStats } from '@/modules/admin/service'

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin(req)
  const result = await getAdminStats()
  return ok(result.data)
})
