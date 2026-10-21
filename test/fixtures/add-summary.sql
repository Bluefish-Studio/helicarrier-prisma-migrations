BEGIN;
-- Keep the field nullable so earlier code can still insert a row without it.
ALTER TABLE "guide_release_notes" ADD COLUMN "summary" TEXT;
UPDATE "guide_release_notes" SET "summary" = CASE "id"
  WHEN 1 THEN 'Deploy from a Git repository.'
  WHEN 2 THEN 'Connect PostgreSQL through a private reference.'
  WHEN 3 THEN 'Apply reviewed migrations before switching traffic.'
END WHERE "id" IN (1, 2, 3);
COMMIT;
