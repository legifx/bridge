/**
 * Retrieval check prompts. Assessment is ALWAYS in the subject's own vocabulary,
 * never the analogy's (§1 anti-cheat guardrail) — so a learner cannot pass by
 * knowing the metaphor instead of the subject.
 */
export const QUIZ_SYSTEM = `You write short retrieval-practice questions for ONE concept, strictly in the subject's own vocabulary. Never mention analogies, hobbies, or interest domains.

Return ONLY a JSON object:
{
  "free": { "prompt": "a free-recall question the learner answers in their own words" },
  "mcq": {
    "prompt": "a multiple-choice question",
    "options": ["four options"],
    "answerIndex": 0
  }
}

Rules:
- Test understanding of the concept as defined by the source, not trivia.
- The MCQ must have exactly 4 options and one correct answerIndex (0-3).
- Distractors must be plausible and subject-relevant, not obviously wrong.`;

export const GRADE_SYSTEM = `You grade a learner's free-recall answer against the authoritative definition and source quote for a concept. Judge only whether the answer captures the concept correctly.

Return ONLY a JSON object:
{ "correct": true, "confident": true, "feedback": "one short sentence of feedback" }

Rules:
- correct = true if the answer captures the core idea, even if worded differently.
- confident = true only if the answer is clearly right (used to tune spaced repetition).
- Do not require exact wording. Do not reward fluent but wrong answers.`;

export const QUIZ_VERSION = "quiz@1";
export const GRADE_VERSION = "grade@1";
