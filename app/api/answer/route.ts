import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { gradeFreeRecall, gradeOpenProblems, checkNumeric, ProblemSchema } from "@/lib/quiz";
import { recordAnswer } from "@/lib/adaptive/review";
import { eloToMastery } from "@/lib/extraction/repo";
import { chargeConcept, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";

const AnsweredProblem = z.object({
  problem: ProblemSchema,
  // numeric -> number, mcq -> chosen index (number), open -> text (string)
  response: z.union([z.number(), z.string(), z.null()]),
});

const BodySchema = z.object({
  conceptId: z.string().min(1),
  freeAnswer: z.string().max(1000),
  mcqCorrect: z.boolean(),
  problems: z.array(AnsweredProblem).max(3).optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });

  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const concept = await prisma.concept.findFirst({
    where: { id: parsed.data.conceptId, learnerId: learner.id },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const charge = await chargeConcept(learner.id, concept.id);
  if (!charge.ok) return quotaExceededResponse(charge.quota, learner.language);

  const grade = await gradeFreeRecall(concept, parsed.data.freeAnswer, learner.language);

  // Grade the practice problems: numeric + mcq deterministically, open via one
  // batched LLM call. Their correctness folds into the overall result.
  const answered = parsed.data.problems ?? [];
  const openItems = answered
    .filter((a) => a.problem.type === "open")
    .map((a) => ({ prompt: a.problem.prompt, solution: a.problem.solution, answer: String(a.response ?? "") }));
  const openGrades = await gradeOpenProblems(openItems, learner.language);
  let oi = 0;
  const problemResults = answered.map((a) => {
    if (a.problem.type === "numeric") {
      const val = typeof a.response === "number" ? a.response : Number(a.response);
      const ok = Number.isFinite(val) && checkNumeric(a.problem.answer, a.problem.tolerance, val);
      return { correct: ok, solution: a.problem.solution };
    }
    if (a.problem.type === "mcq") {
      return { correct: a.response === a.problem.answerIndex, solution: a.problem.solution };
    }
    const g = openGrades[oi++] ?? { correct: false, feedback: "" };
    return { correct: g.correct, feedback: g.feedback, solution: a.problem.solution };
  });
  const allProblemsCorrect = problemResults.every((r) => r.correct);

  const correct = grade.correct && parsed.data.mcqCorrect && allProblemsCorrect;

  const { elo, nextIntervalDays } = await recordAnswer({
    conceptId: concept.id,
    correct,
    confident: grade.confident && parsed.data.mcqCorrect && allProblemsCorrect,
    detail: {
      freeCorrect: grade.correct,
      freeFeedback: grade.feedback,
      mcqCorrect: parsed.data.mcqCorrect,
      problems: problemResults.map((r) => ({ correct: r.correct, feedback: r.feedback ?? null })),
    },
  });

  // Once a concept has actually been recalled, it belongs in the spaced-
  // repetition rotation by default — otherwise the whole review flow only works
  // if the learner remembers to flip a toggle. They can still opt out on the
  // check screen (reviewEnabled=false), which we then respect.
  let reviewEnabled = concept.reviewEnabled;
  if (!reviewEnabled) {
    await prisma.concept.update({ where: { id: concept.id }, data: { reviewEnabled: true } });
    reviewEnabled = true;
  }

  return NextResponse.json({
    grade,
    correct,
    problemResults,
    mastery: eloToMastery(elo),
    nextIntervalDays,
    reviewEnabled,
  });
}
