import { prisma } from '@/lib/prisma'

export async function checkHealth() {
  let connected = false
  let postgisVersion: string | null = null
  try {
    const rows = await prisma.$queryRaw<{ postgis_version: string }[]>`SELECT postgis_version() AS postgis_version`
    postgisVersion = rows[0]?.postgis_version ?? null
    connected = true
  } catch {
    connected = false
  }
  return {
    status: connected ? ('ok' as const) : ('degraded' as const),
    uptimeSec: Math.round(process.uptime()),
    db: { connected, postgisVersion },
  }
}
