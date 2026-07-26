-- Shared daily AI spend counter. Serverless has no shared memory, so the budget
-- ceiling lives here.
CREATE TABLE IF NOT EXISTS "AiSpend" (
  "day" TEXT NOT NULL PRIMARY KEY,
  "microUsd" INTEGER NOT NULL DEFAULT 0,
  "calls" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
