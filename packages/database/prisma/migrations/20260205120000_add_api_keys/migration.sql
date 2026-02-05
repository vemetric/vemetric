CREATE TABLE "api_key" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" VARCHAR NOT NULL,
  "keyHash" TEXT NOT NULL,
  "keyPrefix" VARCHAR NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_key_keyHash_key" ON "api_key"("keyHash");
CREATE INDEX "api_key_projectId_idx" ON "api_key"("projectId");

ALTER TABLE "api_key"
ADD CONSTRAINT "api_key_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
