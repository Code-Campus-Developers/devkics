-- data URLs from the prototype cannot be resolved as Supabase Storage paths.
DELETE FROM "MediaFile" WHERE "storagePath" LIKE 'data:%';