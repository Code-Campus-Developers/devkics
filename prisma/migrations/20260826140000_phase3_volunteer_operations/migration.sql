CREATE TABLE "VolunteerRequirement" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "requiredCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VolunteerRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VolunteerRequirement_tournamentId_role_key" ON "VolunteerRequirement"("tournamentId", "role");
CREATE INDEX "VolunteerRequirement_tournamentId_idx" ON "VolunteerRequirement"("tournamentId");
ALTER TABLE "VolunteerRequirement" ADD CONSTRAINT "VolunteerRequirement_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VolunteerCheckIn" (
  "id" TEXT NOT NULL,
  "volunteerId" TEXT NOT NULL,
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "VolunteerCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VolunteerCheckIn_volunteerId_checkedInAt_idx" ON "VolunteerCheckIn"("volunteerId", "checkedInAt");
ALTER TABLE "VolunteerCheckIn" ADD CONSTRAINT "VolunteerCheckIn_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;