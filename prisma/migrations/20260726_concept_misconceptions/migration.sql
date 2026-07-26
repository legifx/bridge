-- Concept.misconceptions: JSON string[] of what learners typically get wrong,
-- produced by extraction and consumed by the bridge generator/verifier and quiz.
-- Nullable: every row that predates this column keeps working unchanged.
ALTER TABLE "Concept" ADD COLUMN "misconceptions" TEXT;
