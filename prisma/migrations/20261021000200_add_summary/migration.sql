-- Deliberately invalid for a populated table. Use only the disposable guide DB.
BEGIN;
ALTER TABLE "guide_release_notes" ADD COLUMN "summary" TEXT NOT NULL;
COMMIT;
