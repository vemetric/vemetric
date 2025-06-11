-- CreateTable
CREATE TABLE "user_identification_map" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,

    CONSTRAINT "user_identification_map_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_identification_map_projectId_identifier_key" ON "user_identification_map"("projectId", "identifier");
