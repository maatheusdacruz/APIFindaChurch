-- AlterEnum
ALTER TYPE "GuardianStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "GuardianRole" ADD COLUMN     "requestNotes" TEXT;
