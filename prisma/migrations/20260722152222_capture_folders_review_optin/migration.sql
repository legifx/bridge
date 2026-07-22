-- AlterTable
ALTER TABLE "Source" ADD COLUMN "title" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "sourceQuote" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "elo" REAL NOT NULL DEFAULT 1200,
    "reviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedding" BLOB,
    "sourceId" TEXT,
    CONSTRAINT "Concept_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Concept_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Concept" ("definition", "difficulty", "elo", "embedding", "id", "label", "learnerId", "sourceId", "sourceQuote") SELECT "definition", "difficulty", "elo", "embedding", "id", "label", "learnerId", "sourceId", "sourceQuote" FROM "Concept";
DROP TABLE "Concept";
ALTER TABLE "new_Concept" RENAME TO "Concept";
CREATE INDEX "Concept_learnerId_idx" ON "Concept"("learnerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
