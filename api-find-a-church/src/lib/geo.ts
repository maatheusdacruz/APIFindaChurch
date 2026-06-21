import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Consultas geográficas via PostGIS (§3.6). A coluna `geom` nunca é tocada
 * pelo client Prisma; só por SQL bruto aqui.
 */
export type NearRow = { id: number; distance_m: number }

/**
 * IDs de igrejas dentro de `radiusM` de (lat,lng), ordenados por distância
 * crescente. Usa o índice GiST via ST_DWithin (verificável por EXPLAIN).
 */
export async function findNearbyChurchIds(params: {
  lat: number
  lng: number
  radiusM: number
  limit: number
  types?: string[]
}): Promise<NearRow[]> {
  const { lat, lng, radiusM, limit, types } = params
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`
  const typeFilter =
    types && types.length > 0
      ? Prisma.sql`AND "type"::text IN (${Prisma.join(types)})`
      : Prisma.empty

  console.log(`[findNearby] lat=${lat} lng=${lng} raio=${radiusM}m`)
  const rows = await prisma.$queryRaw<NearRow[]>`
    SELECT "id", ST_Distance("geom", ${point}) AS distance_m
    FROM "Church"
    WHERE "geom" IS NOT NULL
      AND ST_DWithin("geom", ${point}, ${radiusM})
      ${typeFilter}
    ORDER BY distance_m ASC
    LIMIT ${limit}
  `
  console.log(`[findNearby] encontradas=${rows.length}`)
  return rows
}

/** Distância (m) de uma igreja específica a um ponto, ou null se sem geom. */
export async function distanceToChurch(churchId: number, lat: number, lng: number): Promise<number | null> {
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`
  const rows = await prisma.$queryRaw<{ distance_m: number | null }[]>`
    SELECT ST_Distance("geom", ${point}) AS distance_m
    FROM "Church"
    WHERE "id" = ${churchId}
  `
  return rows[0]?.distance_m ?? null
}
