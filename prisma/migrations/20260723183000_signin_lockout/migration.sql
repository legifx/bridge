-- Brute-force lockout counters (additive)
ALTER TABLE "Learner" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Learner" ADD COLUMN "lockedUntil" DATETIME;
