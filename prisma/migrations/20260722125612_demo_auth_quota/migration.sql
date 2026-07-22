-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Learner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "handle" TEXT,
    "readingLevel" INTEGER NOT NULL DEFAULT 3,
    "aiUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Learner" ("createdAt", "displayName", "id", "readingLevel") SELECT "createdAt", "displayName", "id", "readingLevel" FROM "Learner";
DROP TABLE "Learner";
ALTER TABLE "new_Learner" RENAME TO "Learner";
CREATE UNIQUE INDEX "Learner_handle_key" ON "Learner"("handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
