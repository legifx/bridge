import { z } from "zod";
import { llmJson } from "@/lib/llm/client";
import { QUIZ_SYSTEM, GRADE_SYSTEM } from "@/lib/prompts/quiz";

export const QuizSchema = z.object({
  free: z.object({ prompt: z.string().min(1) }),
  mcq: z.object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    answerIndex: z.number().int().min(0).max(3),
  }),
});
export type Quiz = z.infer<typeof QuizSchema>;

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
function heuristicGrade(concept: Concept, answer: string): Grade {
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
    feedback: correct ? "Good — that captures the core idea." : "Close, but revisit the definition and try again.",
  };
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
    return heuristicGrade(concept, answer);
  }
}
