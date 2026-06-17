-- CreateTable
CREATE TABLE "saved_filter" (
    "id" TEXT NOT NULL,
    "name" VARCHAR NOT NULL,
    "projectId" TEXT NOT NULL,
    "filterConfig" JSONB NOT NULL,
    "icon" VARCHAR,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_filter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_filter_projectId_idx" ON "saved_filter"("projectId");

-- AddForeignKey
ALTER TABLE "saved_filter" ADD CONSTRAINT "saved_filter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
