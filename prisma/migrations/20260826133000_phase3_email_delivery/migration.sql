ALTER TABLE "Notification" ADD COLUMN "recipientEmail" TEXT;

CREATE INDEX "Notification_recipientEmail_deliveredAt_createdAt_idx"
ON "Notification"("recipientEmail", "deliveredAt", "createdAt");