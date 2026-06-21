-- CreateEnum
CREATE TYPE "statusSuggestion" AS ENUM ('PENDENT', 'REVISION', 'APPLY', 'REJECTED');

-- CreateEnum
CREATE TYPE "SuggestionChangeType" AS ENUM ('ADD', 'EDIT', 'DELETE');

-- CreateTable
CREATE TABLE "MassScheduleSuggestion" (
    "id" SERIAL NOT NULL,
    "churchId" INTEGER NOT NULL,
    "kind" "MassKind" NOT NULL DEFAULT 'MISSA',
    "changeType" "SuggestionChangeType" NOT NULL DEFAULT 'ADD',
    "targetScheduleId" INTEGER,
    "dayOfWeek" INTEGER,
    "date" DATE,
    "startTime" VARCHAR(5) NOT NULL,
    "note" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" "statusSuggestion" NOT NULL DEFAULT 'PENDENT',
    "rejectionReason" TEXT,
    "suggestedById" INTEGER,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MassScheduleSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MassScheduleSuggestion_churchId_status_idx" ON "MassScheduleSuggestion"("churchId", "status");

-- CreateIndex
CREATE INDEX "MassScheduleSuggestion_suggestedById_idx" ON "MassScheduleSuggestion"("suggestedById");

-- CreateIndex
CREATE INDEX "MassScheduleSuggestion_status_idx" ON "MassScheduleSuggestion"("status");

-- AddForeignKey
ALTER TABLE "MassScheduleSuggestion" ADD CONSTRAINT "MassScheduleSuggestion_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassScheduleSuggestion" ADD CONSTRAINT "MassScheduleSuggestion_targetScheduleId_fkey" FOREIGN KEY ("targetScheduleId") REFERENCES "MassSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassScheduleSuggestion" ADD CONSTRAINT "MassScheduleSuggestion_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MassScheduleSuggestion" ADD CONSTRAINT "MassScheduleSuggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
