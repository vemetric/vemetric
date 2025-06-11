/*
  Warnings:

  - Added the required column `priceId` to the `billing_info` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "billing_info" ADD COLUMN     "priceId" VARCHAR NOT NULL;
