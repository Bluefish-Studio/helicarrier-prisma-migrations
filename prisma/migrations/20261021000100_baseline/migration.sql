BEGIN;
CREATE TABLE "guide_release_notes" (
  "id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "guide_release_notes_pkey" PRIMARY KEY ("id")
);
INSERT INTO "guide_release_notes" ("id", "title") VALUES
  (1, 'Give the idea a home'),
  (2, 'Keep the data connected'),
  (3, 'Make the release repeatable');
COMMIT;
