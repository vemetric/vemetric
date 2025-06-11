/*
  Warnings:

  - A unique constraint covering the columns `[apiKey]` on the table `project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "project" ADD COLUMN     "apiKey" VARCHAR NOT NULL DEFAULT 'abc';

-- CreateIndex
CREATE UNIQUE INDEX "project_apiKey_key" ON "project"("apiKey");
