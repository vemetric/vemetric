-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" VARCHAR NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" VARCHAR NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "revokedByUserId" TEXT,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_key_keyHash_key" ON "api_key"("keyHash");

-- CreateIndex
CREATE INDEX "api_key_projectId_idx" ON "api_key"("projectId");

-- CreateIndex
CREATE INDEX "api_key_keyHash_revokedAt_idx" ON "api_key"("keyHash", "revokedAt");

-- CreateIndex
CREATE INDEX "api_key_createdByUserId_idx" ON "api_key"("createdByUserId");

-- CreateIndex
CREATE INDEX "api_key_revokedByUserId_idx" ON "api_key"("revokedByUserId");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identification_map" ADD CONSTRAINT "user_identification_map_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
