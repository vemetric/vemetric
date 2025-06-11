/*
  Warnings:

  - Made the column `organizationId` on table `project` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "project" ALTER COLUMN "organizationId" SET NOT NULL;
