-- CreateTable
CREATE TABLE "Learner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "readingLevel" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InterestDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "embedding" BLOB NOT NULL,
    "alpha" REAL NOT NULL DEFAULT 1,
    "beta" REAL NOT NULL DEFAULT 1,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    CONSTRAINT "InterestDomain_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "imagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Source_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "sourceQuote" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "elo" REAL NOT NULL DEFAULT 1200,
    "embedding" BLOB,
    "sourceId" TEXT,
    CONSTRAINT "Concept_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Concept_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConceptEdge" (
    "fromConceptId" TEXT NOT NULL,
    "toConceptId" TEXT NOT NULL,

    PRIMARY KEY ("fromConceptId", "toConceptId"),
    CONSTRAINT "ConceptEdge_fromConceptId_fkey" FOREIGN KEY ("fromConceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConceptEdge_toConceptId_fkey" FOREIGN KEY ("toConceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bridge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "verdictJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bridge_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bridge_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "InterestDomain" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDueAt" DATETIME NOT NULL,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Review_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bridgeId" TEXT NOT NULL,
    "clicked" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "Bridge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortKey" TEXT NOT NULL,
    "conceptLabel" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "masteredCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "InterestDomain_learnerId_idx" ON "InterestDomain"("learnerId");

-- CreateIndex
CREATE INDEX "Source_learnerId_idx" ON "Source"("learnerId");

-- CreateIndex
CREATE INDEX "Concept_learnerId_idx" ON "Concept"("learnerId");

-- CreateIndex
CREATE INDEX "Bridge_conceptId_idx" ON "Bridge"("conceptId");

-- CreateIndex
CREATE INDEX "Review_conceptId_idx" ON "Review"("conceptId");

-- CreateIndex
CREATE INDEX "ClassSnapshot_cohortKey_idx" ON "ClassSnapshot"("cohortKey");
