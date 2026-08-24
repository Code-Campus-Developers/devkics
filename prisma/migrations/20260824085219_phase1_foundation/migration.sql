-- CreateIndex
CREATE INDEX "AuditLog_cityId_createdAt_idx" ON "AuditLog"("cityId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizerApplication_submittedAt_idx" ON "OrganizerApplication"("submittedAt");

-- CreateIndex
CREATE INDEX "OrganizerApplication_cityId_status_idx" ON "OrganizerApplication"("cityId", "status");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_role_cityId_countryCode_tournament_te_idx" ON "RoleAssignment"("userId", "role", "cityId", "countryCode", "tournament", "teamScope");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");
