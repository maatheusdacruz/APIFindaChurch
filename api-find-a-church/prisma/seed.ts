import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type ChurchType, type FreshnessSource } from '@prisma/client'

/**
 * Seed estrutural (Fase 0/1): importa a base "nome + localização" de um CSV
 * (default: prisma/data/churches.sample.csv; sobrescreva com SEED_CSV) e cria
 * horários de missa de exemplo para exercitar busca/perfil/Missa Agora.
 *
 * A coluna geográfica `geom` é preenchida automaticamente pela trigger no banco.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const CSV_PATH = process.env.SEED_CSV ?? join(process.cwd(), 'prisma/data/churches.sample.csv')

type Row = {
  publicSlug: string
  name: string
  type: ChurchType
  lat: number
  lng: number
  city: string | null
  state: string | null
  district: string | null
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const header = lines.shift()
  if (!header) return []
  const cols = header.split(',')
  return lines.map((line) => {
    const cells = line.split(',')
    const get = (name: string) => cells[cols.indexOf(name)]?.trim() ?? ''
    return {
      publicSlug: get('publicSlug'),
      name: get('name'),
      type: (get('type') || 'IGREJA') as ChurchType,
      lat: Number(get('lat')),
      lng: Number(get('lng')),
      city: get('city') || null,
      state: get('state') || null,
      district: get('district') || null,
    }
  })
}

const DAY = 86_400_000

/** Horários de exemplo para uma igreja. `i` dá variação de frescor entre igrejas. */
function sampleSchedules(now: Date, i: number) {
  const freshConfirmed = new Date(now.getTime() - 5 * DAY)
  const staleConfirmed = new Date(now.getTime() - 200 * DAY)
  const confirmedAt = i % 2 === 0 ? freshConfirmed : staleConfirmed
  const source: FreshnessSource = 'ENRICHMENT'
  return [
    // Missas de domingo
    { kind: 'MISSA' as const, dayOfWeek: 0, startTime: '08:00', source, confidence: 0.9, lastConfirmedAt: confirmedAt },
    { kind: 'MISSA' as const, dayOfWeek: 0, startTime: '10:30', source, confidence: 0.9, lastConfirmedAt: confirmedAt },
    { kind: 'MISSA' as const, dayOfWeek: 0, startTime: '19:00', source, confidence: 0.8, lastConfirmedAt: confirmedAt },
    // Missas diárias (seg–sex)
    { kind: 'MISSA' as const, dayOfWeek: 1, startTime: '07:00', source, confidence: 0.7, lastConfirmedAt: confirmedAt },
    { kind: 'MISSA' as const, dayOfWeek: 3, startTime: '12:15', source, confidence: 0.7, lastConfirmedAt: confirmedAt },
    { kind: 'MISSA' as const, dayOfWeek: 5, startTime: '18:30', source, confidence: 0.7, lastConfirmedAt: confirmedAt },
    // Confissão e adoração
    { kind: 'CONFISSAO' as const, dayOfWeek: 6, startTime: '16:00', source, confidence: 0.6, lastConfirmedAt: confirmedAt },
    { kind: 'ADORACAO' as const, dayOfWeek: 4, startTime: '20:00', source, confidence: 0.6, lastConfirmedAt: confirmedAt },
  ]
}

async function main() {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'))
  if (rows.length === 0) {
    console.warn(`Nenhuma linha no CSV (${CSV_PATH}).`)
    return
  }
  const now = new Date()

  for (const [i, r] of rows.entries()) {
    const church = await prisma.church.upsert({
      where: { publicSlug: r.publicSlug },
      create: {
        publicSlug: r.publicSlug,
        name: r.name,
        type: r.type,
        lat: r.lat,
        lng: r.lng,
        city: r.city,
        state: r.state,
        district: r.district,
      },
      update: {
        name: r.name,
        type: r.type,
        lat: r.lat,
        lng: r.lng,
        city: r.city,
        state: r.state,
        district: r.district,
      },
    })

    await prisma.churchAttribute.upsert({
      where: { churchId: church.id },
      create: {
        churchId: church.id,
        acessibilidade: i % 2 === 0,
        estacionamento: i % 3 === 0,
        confissao: true,
        adoracao: i % 4 === 0,
      },
      update: {},
    })

    // Recria os horários de forma idempotente.
    await prisma.massSchedule.deleteMany({ where: { churchId: church.id } })
    await prisma.massSchedule.createMany({
      data: sampleSchedules(now, i).map((s) => ({ ...s, churchId: church.id })),
    })
  }

  console.log(`Seed concluído: ${rows.length} igrejas (+ atributos e horários).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
