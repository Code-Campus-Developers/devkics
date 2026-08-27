-- Replace database-resident image data with Supabase Storage object paths.
ALTER TABLE "MediaFile" RENAME COLUMN "dataUrl" TO "storagePath";

CREATE UNIQUE INDEX "MediaFile_storagePath_key" ON "MediaFile"("storagePath");