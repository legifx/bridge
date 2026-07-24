import { z } from "zod";
import { llmJson } from "@/lib/llm/client";
import { st } from "@/lib/i18n";
import { QUIZ_SYSTEM, GRADE_SYSTEM, OPEN_GRADE_SYSTEM } from "@/lib/prompts/quiz";

/** A real, solvable practice problem. The agent picks the type that fits the
 *  subject: numeric for quantitative work, mcq for recognition, open for applied
 *  reasoning. `solution` is the worked answer, shown after the learner tries. */
export const ProblemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("numeric"),
    prompt: z.string().min(1),
    answer: z.number().finite(),
    tolerance: z.number().nonnegative().max(1e9).optional(),
    unit: z.string().max(16).optional(),
    solution: z.string().min(1),
  }),
  z.object({
    type: z.literal("mcq"),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    answerIndex: z.number().int().min(0).max(3),
    solution: z.string().min(1),
  }),
  z.object({
    type: z.literal("open"),
    prompt: z.string().min(1),
    solution: z.string().min(1), // model answer / rubric — shown after, and grades the open answer
  }),
]);
export type Problem = z.infer<typeof ProblemSchema>;

export const QuizSchema = z.object({
  free: z.object({ prompt: z.string().min(1) }),
  mcq: z.object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    answerIndex: z.number().int().min(0).max(3),
  }),
  problems: z.array(ProblemSchema).min(1).max(3),
});
export type Quiz = z.infer<typeof QuizSchema>;

/** Check a numeric answer against the expected value with tolerance. */
export function checkNumeric(expected: number, tolerance: number | undefined, given: number): boolean {
  const tol = tolerance ?? Math.max(1e-9, Math.abs(expected) * 0.01);
  return Math.abs(given - expected) <= tol;
}

export const GradeSchema = z.object({
  correct: z.boolean(),
  confident: z.boolean(),
  feedback: z.string(),
});
export type Grade = z.infer<typeof GradeSchema>;

type Concept = { id: string; label: string; definition: string; sourceQuote: string };

export async function generateQuiz(concept: Concept, language?: string): Promise<Quiz> {
  return llmJson({
    system: QUIZ_SYSTEM,
    user: `Concept: ${concept.label}\nDefinition: ${concept.definition}\nSource: "${concept.sourceQuote}"`,
    schema: QuizSchema,
    temperature: 0.4,
    language,
  });
}

/**
 * Resilience fallback only (NOT a demo mode): if the grading call fails,
 * a keyword-overlap heuristic keeps the session alive instead of bricking it.
 */
function heuristicGrade(concept: Concept, answer: string, language?: string): Grade {
  const stop = new Set(["the", "a", "an", "of", "to", "and", "is", "are", "that", "in", "it", "its", "with", "by", "as"]);
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stop.has(w)),
    );
  const ref = tokens(`${concept.label} ${concept.definition}`);
  const ans = tokens(answer);
  let hits = 0;
  for (const w of ans) if (ref.has(w)) hits++;
  const overlap = ref.size ? hits / Math.min(ref.size, 8) : 0;
  const correct = overlap >= 0.34 && ans.size >= 3;
  return {
    correct,
    confident: overlap >= 0.6,
    feedback: correct ? st(language, "engine.gradeGood") : st(language, "engine.gradeClose"),
  };
}

const OpenGradeSchema = z.object({
  results: z.array(z.object({ correct: z.boolean(), feedback: z.string() })),
});

/** Grade open practice answers against their model solutions — one batched call. */
export async function gradeOpenProblems(
  items: { prompt: string; solution: string; answer: string }[],
  language?: string,
): Promise<{ correct: boolean; feedback: string }[]> {
  if (items.length === 0) return [];
  try {
    const { results } = await llmJson({
      system: OPEN_GRADE_SYSTEM,
      user: items
        .map(
          (it, i) =>
            `Problem ${i + 1}: ${it.prompt}\nModel answer: ${it.solution}\nLearner answer: ${it.answer}`,
        )
        .join("\n\n"),
      schema: OpenGradeSchema,
      temperature: 0,
      language,
    });
    return items.map((_, i) => results[i] ?? { correct: false, feedback: "" });
  } catch {
    return items.map(() => ({ correct: false, feedback: "" }));
  }
}

export async function gradeFreeRecall(concept: Concept, answer: string, language?: string): Promise<Grade> {
  try {
    return await llmJson({
      system: GRADE_SYSTEM,
      user: `Concept: ${concept.label}\nAuthoritative definition: ${concept.definition}\nSource: "${concept.sourceQuote}"\n\nLearner's answer: ${answer}`,
      schema: GradeSchema,
      temperature: 0,
      language,
    });
  } catch {
    return heuristicGrade(concept, answer, language);
  }
}
