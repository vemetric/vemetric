-- CreateTable
CREATE TABLE "bootstrap_lock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bootstrap_lock_pkey" PRIMARY KEY ("id")
);
