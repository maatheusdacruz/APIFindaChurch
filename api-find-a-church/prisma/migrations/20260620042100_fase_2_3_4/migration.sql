-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'IN_REVIEW');

-- CreateEnum
CREATE TYPE "SuggestionSource" AS ENUM ('APP', 'WHATSAPP', 'TELEGRAM', 'FORM', 'ENRICHMENT');

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('LOW', 'HIGH');

-- CreateEnum
CREATE TYPE "FeedbackValue" AS ENUM ('CONFIRM', 'DENY');

-- CreateEnum
CREATE TYPE "EnrichmentJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('MASS_REMINDER', 'EVENT_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParishStatus" AS ENUM ('UNCLAIMED', 'PROVISIONAL', 'VERIFIED');

-- CreateEnum
CREATE TYPE "GuardianStatus" AS ENUM ('ACTIVE', 'FROZEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "AdminValidationLevel" AS ENUM ('PROVISIONAL', 'VERIFIED');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "MuralPostType" AS ENUM ('AVISO', 'EVENTO', 'PEDIDO', 'CAMPANHA');

-- CreateEnum
CREATE TYPE "ConsensusOutcome" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" SERIAL NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "currentValue" TEXT,
    "proposedValue" TEXT NOT NULL,
    "riskTier" "RiskTier" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "SuggestionSource" NOT NULL DEFAULT 'APP',
    "submittedByRef" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" SERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedByRef" TEXT,
    "source" "FreshnessSource" NOT NULL,
    "reversibleOf" INTEGER,
    "suggestionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "value" "FeedbackValue" NOT NULL,
    "deviceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentSource" (
    "id" SERIAL NOT NULL,
    "origin" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrichmentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "matchedChurchId" INTEGER,
    "coverage" DOUBLE PRECISION,
    "quality" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pushToken" TEXT,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" INTEGER NOT NULL,
    "churchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","churchId")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "churchId" INTEGER NOT NULL,
    "massScheduleId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "churchId" INTEGER NOT NULL,
    "massScheduleId" INTEGER,
    "kind" "NotificationKind" NOT NULL DEFAULT 'MASS_REMINDER',
    "fireAt" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ParishStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "claimedByAdminId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurchParish" (
    "churchId" INTEGER NOT NULL,
    "parishId" INTEGER NOT NULL,
    "contested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChurchParish_pkey" PRIMARY KEY ("churchId","parishId")
);

-- CreateTable
CREATE TABLE "GuardianRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "churchId" INTEGER NOT NULL,
    "status" "GuardianStatus" NOT NULL DEFAULT 'ACTIVE',
    "behavioralScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "parishId" INTEGER NOT NULL,
    "validationLevel" "AdminValidationLevel" NOT NULL DEFAULT 'PROVISIONAL',
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reporterRef" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" SERIAL NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "guardianRoleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsensusState" (
    "id" SERIAL NOT NULL,
    "suggestionId" INTEGER NOT NULL,
    "outcome" "ConsensusOutcome" NOT NULL DEFAULT 'PENDING',
    "totalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "threshold" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsensusState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsensusVote" (
    "id" SERIAL NOT NULL,
    "consensusStateId" INTEGER NOT NULL,
    "suggestionId" INTEGER NOT NULL,
    "voterId" INTEGER NOT NULL,
    "approve" BOOLEAN NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsensusVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuralPost" (
    "id" SERIAL NOT NULL,
    "churchId" INTEGER NOT NULL,
    "type" "MuralPostType" NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuralPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_targetType_targetId_idx" ON "Suggestion"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Suggestion_status_idx" ON "Suggestion"("status");

-- CreateIndex
CREATE INDEX "Revision_entity_entityId_idx" ON "Revision"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Revision_suggestionId_idx" ON "Revision"("suggestionId");

-- CreateIndex
CREATE INDEX "Feedback_targetType_targetId_idx" ON "Feedback"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrichmentSource_origin_key" ON "EnrichmentSource"("origin");

-- CreateIndex
CREATE INDEX "EnrichmentJob_sourceId_idx" ON "EnrichmentJob"("sourceId");

-- CreateIndex
CREATE INDEX "EnrichmentJob_matchedChurchId_idx" ON "EnrichmentJob"("matchedChurchId");

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceId_key" ON "User"("deviceId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "CheckIn_churchId_createdAt_idx" ON "CheckIn"("churchId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckIn_userId_createdAt_idx" ON "CheckIn"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledNotification_userId_idx" ON "ScheduledNotification"("userId");

-- CreateIndex
CREATE INDEX "ScheduledNotification_fireAt_status_idx" ON "ScheduledNotification"("fireAt", "status");

-- CreateIndex
CREATE INDEX "ChurchParish_parishId_idx" ON "ChurchParish"("parishId");

-- CreateIndex
CREATE INDEX "GuardianRole_churchId_status_idx" ON "GuardianRole"("churchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRole_userId_churchId_key" ON "GuardianRole"("userId", "churchId");

-- CreateIndex
CREATE INDEX "AdminRole_parishId_idx" ON "AdminRole"("parishId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_userId_parishId_key" ON "AdminRole"("userId", "parishId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_fromUserId_guardianRoleId_key" ON "Endorsement"("fromUserId", "guardianRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsensusState_suggestionId_key" ON "ConsensusState"("suggestionId");

-- CreateIndex
CREATE INDEX "ConsensusVote_suggestionId_idx" ON "ConsensusVote"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsensusVote_consensusStateId_voterId_key" ON "ConsensusVote"("consensusStateId", "voterId");

-- CreateIndex
CREATE INDEX "MuralPost_churchId_createdAt_idx" ON "MuralPost"("churchId", "createdAt");

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentJob" ADD CONSTRAINT "EnrichmentJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EnrichmentSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchParish" ADD CONSTRAINT "ChurchParish_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurchParish" ADD CONSTRAINT "ChurchParish_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRole" ADD CONSTRAINT "GuardianRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRole" ADD CONSTRAINT "GuardianRole_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRole" ADD CONSTRAINT "AdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRole" ADD CONSTRAINT "AdminRole_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_guardianRoleId_fkey" FOREIGN KEY ("guardianRoleId") REFERENCES "GuardianRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsensusState" ADD CONSTRAINT "ConsensusState_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsensusVote" ADD CONSTRAINT "ConsensusVote_consensusStateId_fkey" FOREIGN KEY ("consensusStateId") REFERENCES "ConsensusState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsensusVote" ADD CONSTRAINT "ConsensusVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsensusVote" ADD CONSTRAINT "ConsensusVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuralPost" ADD CONSTRAINT "MuralPost_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuralPost" ADD CONSTRAINT "MuralPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
