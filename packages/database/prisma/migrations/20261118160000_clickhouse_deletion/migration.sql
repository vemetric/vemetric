-- CreateTable
CREATE TABLE "clickhouse_deletion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" VARCHAR NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "clickhouse_deletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clickhouse_deletion_deletedAt_createdAt_idx" ON "clickhouse_deletion"("deletedAt", "createdAt");

