-- Habilita PostGIS (obrigatório para a coluna geography e busca por proximidade — §3.6).
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "ChurchType" AS ENUM ('IGREJA', 'CAPELA', 'BASILICA', 'SANTUARIO', 'MOSTEIRO', 'SEMINARIO');

-- CreateEnum
CREATE TYPE "MassKind" AS ENUM ('MISSA', 'CONFISSAO', 'ADORACAO');

-- CreateEnum
CREATE TYPE "FreshnessSource" AS ENUM ('ENRICHMENT', 'USER_FEEDBACK', 'SUGGESTION', 'ADMIN', 'GUARDIAN');

-- CreateTable
CREATE TABLE "Church" (
    "id" SERIAL NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChurchType" NOT NULL DEFAULT 'IGREJA',
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "geom" geography(Point, 4326),
    "addressLine" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MassSchedule" (
    "id" SERIAL NOT NULL,
    "churchId" INTEGER NOT NULL,
    "kind" "MassKind" NOT NULL DEFAULT 'MISSA',
    "dayOfWeek" INTEGER,
    "date" DATE,
    "startTime" VARCHAR(5) NOT NULL,
    "note" TEXT,
    "lastConfirmedAt" TIMESTAMP(3),
    "source" "FreshnessSource" NOT NULL DEFAULT 'ENRICHMENT',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchAttribute" (
    "churchId" INTEGER NOT NULL,
    "acessibilidade" BOOLEAN NOT NULL DEFAULT false,
    "estacionamento" BOOLEAN NOT NULL DEFAULT false,
    "livraria" BOOLEAN NOT NULL DEFAULT false,
    "adoracao" BOOLEAN NOT NULL DEFAULT false,
    "confissao" BOOLEAN NOT NULL DEFAULT false,
    "grupoJovens" BOOLEAN NOT NULL DEFAULT false,
    "catequese" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurchAttribute_pkey" PRIMARY KEY ("churchId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "churchId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Church_publicSlug_key" ON "Church"("publicSlug");

-- CreateIndex
CREATE INDEX "Church_type_idx" ON "Church"("type");

-- CreateIndex
CREATE INDEX "Church_city_idx" ON "Church"("city");

-- CreateIndex
CREATE INDEX "MassSchedule_churchId_kind_idx" ON "MassSchedule"("churchId", "kind");

-- CreateIndex
CREATE INDEX "MassSchedule_dayOfWeek_idx" ON "MassSchedule"("dayOfWeek");

-- CreateIndex
CREATE INDEX "Event_churchId_startsAt_idx" ON "Event"("churchId", "startsAt");

-- AddForeignKey
ALTER TABLE "MassSchedule" ADD CONSTRAINT "MassSchedule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchAttribute" ADD CONSTRAINT "ChurchAttribute_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────── PostGIS: sincronização lat/lng → geom + índice GiST (§3.6) ─────────

-- Mantém `geom` derivada de lat/lng em toda escrita (a app nunca escreve geom direto).
CREATE OR REPLACE FUNCTION church_sync_geom() RETURNS trigger AS $$
BEGIN
  NEW."geom" := ST_SetSRID(
    ST_MakePoint(NEW."lng"::double precision, NEW."lat"::double precision),
    4326
  )::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER church_geom_sync
BEFORE INSERT OR UPDATE OF "lat", "lng" ON "Church"
FOR EACH ROW EXECUTE FUNCTION church_sync_geom();

-- Índice espacial usado por ST_DWithin / ST_Distance.
CREATE INDEX "church_geom_gix" ON "Church" USING GIST ("geom");
