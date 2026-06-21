/**
 * Seed de horários de missa para as igrejas existentes.
 * Roda apenas em igrejas que ainda não têm horários.
 *
 * Uso: npm run db:seed-schedules
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type FreshnessSource } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const DAY = 86_400_000
const source: FreshnessSource = 'ENRICHMENT'

function schedules(churchId: number, i: number) {
  const now = Date.now()
  const freshAt = new Date(now - 5 * DAY)
  const staleAt = new Date(now - 200 * DAY)
  const confirmedAt = i % 3 === 0 ? staleAt : freshAt
  const conf = i % 3 === 0 ? 0.6 : 0.85

  return [
    { churchId, kind: 'MISSA' as const, dayOfWeek: 0, startTime: '08:00', source, confidence: conf, lastConfirmedAt: confirmedAt },
    { churchId, kind: 'MISSA' as const, dayOfWeek: 0, startTime: '10:30', source, confidence: conf, lastConfirmedAt: confirmedAt },
    { churchId, kind: 'MISSA' as const, dayOfWeek: 0, startTime: '19:00', source, confidence: conf, lastConfirmedAt: confirmedAt },
    { churchId, kind: 'MISSA' as const, dayOfWeek: 3, startTime: '12:15', source, confidence: conf, lastConfirmedAt: confirmedAt },
    { churchId, kind: 'MISSA' as const, dayOfWeek: 5, startTime: '18:30', source, confidence: conf, lastConfirmedAt: confirmedAt },
    { churchId, kind: 'CONFISSAO' as const, dayOfWeek: 6, startTime: '16:00', source, confidence: 0.6, lastConfirmedAt: confirmedAt },
  ]
}

async function main() {
  const churches = await prisma.church.findMany({
    where: { massSchedules: { none: {} } },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  if (churches.length === 0) {
    console.log('Todas as igrejas já têm horários.')
    return
  }

  console.log(`Adicionando horários para ${churches.length} igrejas…`)

  let count = 0
  for (const [i, church] of churches.entries()) {
    await prisma.massSchedule.createMany({ data: schedules(church.id, i) })
    count++
    if (count % 100 === 0) process.stdout.write(`\r  ${count}/${churches.length}…`)
  }

  console.log(`\nConcluído: ${count} igrejas com 6 horários cada.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
