/*
  Warnings:

  - Made the column `name` on table `organization` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "featureFlags" VARCHAR,
ALTER COLUMN "name" SET NOT NULL;
