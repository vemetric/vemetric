-- CreateTable
CREATE TABLE "failed_queue_job" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueName" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "error" TEXT NOT NULL,

    CONSTRAINT "failed_queue_job_pkey" PRIMARY KEY ("id")
);
