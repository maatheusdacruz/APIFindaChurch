import { route, ok } from '@/lib/http'
import { checkHealth } from '@/modules/health/service'

// GET /api/health — status do app + banco (inclui postgis_version()).
export const GET = route(async () => {
  const health = await checkHealth()
  return ok(health, undefined, health.db.connected ? 200 : 503)
})
