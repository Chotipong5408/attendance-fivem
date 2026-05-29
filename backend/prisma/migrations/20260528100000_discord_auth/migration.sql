-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discordId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "icName" TEXT;

-- Backfill icName from username for existing rows
UPDATE "users" SET "icName" = "username" WHERE "icName" IS NULL;

-- Unique Discord ID (multiple NULLs allowed in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "users_discordId_key" ON "users"("discordId");
