-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" VARCHAR,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organization" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,

    CONSTRAINT "user_organization_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "project" (
    "id" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,
    "domain" VARCHAR NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_project" (
    "userId" TEXT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "role" "ProjectRole" NOT NULL,

    CONSTRAINT "user_project_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "app_user" (
    "projectId" BIGINT NOT NULL,
    "id" BIGINT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSON NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("projectId","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_domain_key" ON "project"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_projectId_identifier_key" ON "app_user"("projectId", "identifier");

-- AddForeignKey
ALTER TABLE "user_organization" ADD CONSTRAINT "user_organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_organization" ADD CONSTRAINT "user_organization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
