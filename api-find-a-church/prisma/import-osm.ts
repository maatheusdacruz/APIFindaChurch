/**
 * Importador OSM → banco (Fases 0/1).
 *
 * Uso:
 *   IMPORT_JSON=./meu-arquivo.json npm run db:import
 *   IMPORT_JSON=./meu-arquivo.json BATCH_SIZE=200 npm run db:import
 *
 * Espera um array JSON de objetos no formato exportado pelo pipeline OSM
 * (campos: osm_id, name, latitude, longitude, city, state, address, tags, photo_url…).
 *
 * Idempotente: usa upsert em publicSlug "osm-<osm_id>".
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type ChurchType } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const JSON_PATH = process.env.IMPORT_JSON ?? './prisma/data/churches.osm.json'
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 100)

// ─── Mapeamento estado (nome completo → sigla) ───────────────────────────────
const STATE_ABBR: Record<string, string> = {
  Acre: 'AC', Alagoas: 'AL', Amapá: 'AP', Amazonas: 'AM',
  Bahia: 'BA', Ceará: 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  Goiás: 'GO', Maranhão: 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', Pará: 'PA', Paraíba: 'PB', Paraná: 'PR',
  Pernambuco: 'PE', Piauí: 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', Rondônia: 'RO', Roraima: 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', Sergipe: 'SE', Tocantins: 'TO',
}

function toStateAbbr(state: string | null | undefined): string | null {
  if (!state) return null
  return STATE_ABBR[state] ?? (state.length === 2 ? state.toUpperCase() : null)
}

// ─── Detecção de tipo pelo kind OSM e pelo nome ──────────────────────────────
const KIND_MAP: Record<string, ChurchType> = {
  chapel: 'CAPELA', basilica: 'BASILICA', monastery: 'MOSTEIRO',
  sanctuary: 'SANTUARIO', seminary: 'SEMINARIO',
}

function detectType(name: string, kind?: string): ChurchType {
  if (kind && KIND_MAP[kind.toLowerCase()]) return KIND_MAP[kind.toLowerCase()]
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/basilica/.test(n)) return 'BASILICA'
  if (/santuario|sanctuary/.test(n)) return 'SANTUARIO'
  if (/mosteiro|monastery|abadia/.test(n)) return 'MOSTEIRO'
  if (/seminario|seminary/.test(n)) return 'SEMINARIO'
  if (/capela|chapel/.test(n)) return 'CAPELA'
  return 'IGREJA'
}

// ─── Estrutura do JSON de entrada ────────────────────────────────────────────
interface OsmRecord {
  osm_id: number
  osm_type?: string
  name: string
  kind?: string
  denomination?: string
  latitude: number
  longitude: number
  address?: string
  city?: string
  state?: string
  score?: number
  is_catholic?: boolean
  photo_url?: string | null
  photo_source?: string | null
  tags?: Record<string, string>
}

function mapRecord(r: OsmRecord) {
  const tags = r.tags ?? {}
  return {
    publicSlug:  `osm-${r.osm_id}`,
    name:        r.name,
    type:        detectType(r.name, r.kind),
    lat:         r.latitude,
    lng:         r.longitude,
    city:        r.city || tags['addr:city'] || null,
    state:       toStateAbbr(r.state || tags['addr:state'] || null),
    district:    tags['addr:suburb'] || tags['addr:neighbourhood'] || null,
    addressLine: tags['addr:street']
                   ? `${tags['addr:street']}${tags['addr:housenumber'] ? ', ' + tags['addr:housenumber'] : ''}`
                   : (r.address || null),
    postalCode:  tags['addr:postcode'] || null,
    phone:       tags['phone'] || tags['contact:phone'] || null,
    photoUrl:    r.photo_url || null,
  }
}

// ─── Importação em batches ────────────────────────────────────────────────────
async function main() {
  const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as OsmRecord[]
  // Suporta array direto ou objeto envelope com qualquer das chaves conhecidas.
  const ARRAY_KEYS = ['parishes', 'churches', 'data', 'items', 'results']
  let records: OsmRecord[]
  if (Array.isArray(raw)) {
    records = raw
  } else {
    const envelope = raw as Record<string, unknown>
    const key = ARRAY_KEYS.find((k) => Array.isArray(envelope[k]))
    records = key ? (envelope[key] as OsmRecord[]) : []
  }

  if (records.length === 0) {
    console.warn(`Nenhum registro encontrado em ${JSON_PATH}.`)
    return
  }

  console.log(`Importando ${records.length} igrejas em batches de ${BATCH_SIZE}…`)

  let created = 0, updated = 0, skipped = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (r) => {
        if (!r.name || !r.latitude || !r.longitude) { skipped++; return }

        const data = mapRecord(r)
        const existed = await prisma.church.findUnique({ where: { publicSlug: data.publicSlug } })

        await prisma.church.upsert({
          where: { publicSlug: data.publicSlug },
          create: {
            ...data,
            attribute: {
              create: {
                // Atributos vindos das tags OSM (quando presentes).
                acessibilidade: Boolean(r.tags?.['wheelchair'] && r.tags['wheelchair'] !== 'no'),
                estacionamento: Boolean(r.tags?.['parking']),
                confissao: false,
                adoracao: false,
                livraria: false,
                grupoJovens: false,
                catequese: false,
              },
            },
          },
          update: {
            name:        data.name,
            type:        data.type,
            city:        data.city,
            state:       data.state,
            district:    data.district,
            addressLine: data.addressLine,
            postalCode:  data.postalCode,
            phone:       data.phone ?? undefined,
            photoUrl:    data.photoUrl ?? undefined,
          },
        })

        existed ? updated++ : created++
      }),
    )

    const done = Math.min(i + BATCH_SIZE, records.length)
    process.stdout.write(`\r  ${done}/${records.length} processados…`)
  }

  console.log(`\nConcluído: ${created} criadas, ${updated} atualizadas, ${skipped} ignoradas.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
