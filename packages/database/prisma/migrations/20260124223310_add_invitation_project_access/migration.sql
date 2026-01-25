-- CreateTable
CREATE TABLE "invitation_project_access" (
    "invitationToken" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "invitation_project_access_pkey" PRIMARY KEY ("invitationToken","projectId")
);

-- CreateIndex
CREATE INDEX "invitation_project_access_invitationToken_organizationId_idx" ON "invitation_project_access"("invitationToken", "organizationId");

-- AddForeignKey
ALTER TABLE "invitation_project_access" ADD CONSTRAINT "invitation_project_access_invitationToken_fkey" FOREIGN KEY ("invitationToken") REFERENCES "invitation"("token") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_project_access" ADD CONSTRAINT "invitation_project_access_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "project"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_project_access" ADD CONSTRAINT "invitation_project_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
