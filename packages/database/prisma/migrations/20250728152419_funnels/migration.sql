-- CreateTable
CREATE TABLE "funnel" (
    "id" TEXT NOT NULL,
    "name" VARCHAR NOT NULL,
    "projectId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "funnel" ADD CONSTRAINT "funnel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
