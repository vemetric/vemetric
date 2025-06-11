/*
  Warnings:

  - You are about to drop the column `subscriptionCancelUrl` on the `billing_info` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionUpdateUrl` on the `billing_info` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "billing_info" DROP COLUMN "subscriptionCancelUrl",
DROP COLUMN "subscriptionUpdateUrl",
ALTER COLUMN "businessId" DROP NOT NULL,
ALTER COLUMN "subscriptionNextBilledAt" DROP NOT NULL;
