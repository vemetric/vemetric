/*
  Warnings:

  - The primary key for the `email_verification_token` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `expires` on the `email_verification_token` table. All the data in the column will be lost.
  - You are about to drop the column `email_verified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `active_expires` on the `user_session` table. All the data in the column will be lost.
  - You are about to drop the column `idle_expires` on the `user_session` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `user_session` table. All the data in the column will be lost.
  - You are about to drop the `user_key` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `email_verification_token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `email_verification_token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `user_session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `user_session` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_key" DROP CONSTRAINT "user_key_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_session" DROP CONSTRAINT "user_session_user_id_fkey";

-- DropIndex
DROP INDEX "user_session_user_id_idx";

-- AlterTable
ALTER TABLE "email_verification_token" DROP CONSTRAINT "email_verification_token_pkey",
DROP COLUMN "expires",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user" DROP COLUMN "email_verified",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_session" DROP COLUMN "active_expires",
DROP COLUMN "idle_expires",
DROP COLUMN "user_id",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "user_key";

-- CreateTable
CREATE TABLE "user_password" (
    "id" BIGSERIAL NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "user_password_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_password_userId_key" ON "user_password"("userId");

-- CreateIndex
CREATE INDEX "user_password_userId_idx" ON "user_password"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_token_userId_key" ON "email_verification_token"("userId");

-- CreateIndex
CREATE INDEX "user_session_userId_idx" ON "user_session"("userId");

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_password" ADD CONSTRAINT "user_password_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
