import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentLearner } from "@/lib/db/learner";
import { gradeFreeRecall, gradeOpenProblems, checkNumeric, ProblemSchema } from "@/lib/quiz";
import { recordAnswer } from "@/lib/adaptive/review";
import { eloToMastery } from "@/lib/extraction/repo";
import { chargeConcept, quotaExceededResponse } from "@/lib/quota";

export const runtime = "nodejs";
// Serverless ceiling: free-recall grading plus one batched open-problem call.
// 60s is the ceiling every Vercel plan allows and 4x the platform default;
// raise it in vercel.json on plans that permit more.
export const maxDuration = 60;

const AnsweredProblem = z.object({
  problem: ProblemSchema,
  // numeric -> number, mcq -> chosen index (number), open -> text (string)
  response: z.union([z.number(), z.string(), z.null()]),
});

const BodySchema = z.object({
  conceptId: z.string().min(1),
  freeAnswer: z.string().max(1000),
  mcqCorrect: z.boolean(),
  problems: z.array(AnsweredProblem).max(6).optional(),
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

  // Points-based, teacher-style scoring. Each question is worth points; free
  // recall and open problems earn PARTIAL credit (their 0..1 score × points);
  // mcq/numeric are all-or-nothing. The check score is earned/total — a real
  // grade, not an all-or-nothing pass/fail.
  const FREE_POINTS = 3;
  const MCQ_POINTS = 2;
  const PROBLEM_POINTS = { numeric: 3, mcq: 2, open: 4 } as const;

  const answered = parsed.data.problems ?? [];
  const openItems = answered
    .filter((a) => a.problem.type === "open")
    .map((a) => ({ prompt: a.problem.prompt, solution: a.problem.solution, answer: String(a.response ?? "") }));
  const openGrades = await gradeOpenProblems(openItems, learner.language);
  let oi = 0;
  const problemResults = answered.map((a) => {
    const max = PROBLEM_POINTS[a.problem.type];
    if (a.problem.type === "numeric") {
      const val = typeof a.response === "number" ? a.response : Number(a.response);
      const ok = Number.isFinite(val) && checkNumeric(a.problem.answer, a.problem.tolerance, val);
      return { correct: ok, score: ok ? 1 : 0, earned: ok ? max : 0, max, solution: a.problem.solution };
    }
    if (a.problem.type === "mcq") {
      const ok = a.response === a.problem.answerIndex;
      return { correct: ok, score: ok ? 1 : 0, earned: ok ? max : 0, max, solution: a.problem.solution };
    }
    const g = openGrades[oi++] ?? { score: 0, feedback: "" };
    return {
      correct: g.score >= 0.6,
      score: g.score,
      earned: g.score * max,
      max,
      feedback: g.feedback,
      solution: a.problem.solution,
    };
  });

  const earned =
    grade.score * FREE_POINTS +
    (parsed.data.mcqCorrect ? MCQ_POINTS : 0) +
    problemResults.reduce((s, r) => s + r.earned, 0);
  const total = FREE_POINTS + MCQ_POINTS + problemResults.reduce((s, r) => s + r.max, 0);
  const scorePct = total > 0 ? earned / total : 0;

  const { elo, nextIntervalDays } = await recordAnswer({
    conceptId: concept.id,
    score: scorePct,
    detail: {
      score: scorePct,
      earned: Math.round(earned * 10) / 10,
      total,
      freeCorrect: grade.score >= 0.6,
      freeScore: grade.score,
      freeFeedback: grade.feedback,
      mcqCorrect: parsed.data.mcqCorrect,
      problems: problemResults.map((r) => ({
        correct: r.correct,
        score: r.score,
        earned: Math.round(r.earned * 10) / 10,
        max: r.max,
        feedback: r.feedback ?? null,
      })),
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
    score: scorePct, // this check's grade, 0..1 — coherent with the points earned
    earned: Math.round(earned * 10) / 10,
    total,
    passed: scorePct >= 0.6,
    problemResults,
    mastery: eloToMastery(elo), // long-term mastery across attempts (secondary)
    nextIntervalDays,
    reviewEnabled,
  });
}
