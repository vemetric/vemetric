-- AlterEnum
ALTER TYPE "DripSequenceType" ADD VALUE 'FIRST_EVENT_FEEDBACK';

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "firstEventAt" TIMESTAMP(3);
