-- CreateEnum
CREATE TYPE "DripSequenceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "DripSequenceType" AS ENUM ('NO_EVENTS', 'NO_PROJECT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "receiveEmailTips" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "email_drip_sequence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "sequenceType" "DripSequenceType" NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "DripSequenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastEmailSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "email_drip_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_drip_history" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "sequenceType" "DripSequenceType" NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "emailAddress" VARCHAR NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" VARCHAR,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "email_drip_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_drip_sequence_projectId_sequenceType_key" ON "email_drip_sequence"("projectId", "sequenceType");

-- CreateIndex
CREATE UNIQUE INDEX "email_drip_sequence_userId_sequenceType_key" ON "email_drip_sequence"("userId", "sequenceType");

-- AddForeignKey
ALTER TABLE "email_drip_sequence" ADD CONSTRAINT "email_drip_sequence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drip_sequence" ADD CONSTRAINT "email_drip_sequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drip_history" ADD CONSTRAINT "email_drip_history_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_drip_sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drip_history" ADD CONSTRAINT "email_drip_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drip_history" ADD CONSTRAINT "email_drip_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
