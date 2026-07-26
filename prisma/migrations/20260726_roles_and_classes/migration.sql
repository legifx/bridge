-- Roles and teaching groups. Before this, /api/teacher had no boundary at all:
-- the "cohort" was every learner in the database. A teacher now sees only the
-- class they own, and only if they are actually a teacher.
ALTER TABLE "Learner" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'learner';
ALTER TABLE "Learner" ADD COLUMN "classId" TEXT;

CREATE TABLE IF NOT EXISTS "SchoolClass" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "joinCode" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolClass_joinCode_key" ON "SchoolClass"("joinCode");
CREATE INDEX IF NOT EXISTS "SchoolClass_teacherId_idx" ON "SchoolClass"("teacherId");
CREATE INDEX IF NOT EXISTS "Learner_classId_idx" ON "Learner"("classId");
