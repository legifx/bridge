-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InterestDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "embedding" BLOB NOT NULL,
    "anchors" TEXT NOT NULL DEFAULT '[]',
    "alpha" REAL NOT NULL DEFAULT 1,
    "beta" REAL NOT NULL DEFAULT 1,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    CONSTRAINT "InterestDomain_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InterestDomain" ("alpha", "beta", "confidence", "embedding", "id", "learnerId", "name") SELECT "alpha", "beta", "confidence", "embedding", "id", "learnerId", "name" FROM "InterestDomain";
DROP TABLE "InterestDomain";
ALTER TABLE "new_InterestDomain" RENAME TO "InterestDomain";
CREATE INDEX "InterestDomain_learnerId_idx" ON "InterestDomain"("learnerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
