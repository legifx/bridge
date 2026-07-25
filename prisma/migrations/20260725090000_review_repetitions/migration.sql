-- SM-2 needs the repetition count, and it was being reconstructed from the
-- interval (interval 6 == "second repetition"), which is a guess: an interval
-- that lands on 6 later in the ladder resets a learner's progress.
ALTER TABLE "Review" ADD COLUMN "repetitions" INTEGER NOT NULL DEFAULT 0;
