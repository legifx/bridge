-- Optional account lock + owner unlimited flag (additive)
ALTER TABLE "Learner" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Learner" ADD COLUMN "unlimited" BOOLEAN NOT NULL DEFAULT false;
