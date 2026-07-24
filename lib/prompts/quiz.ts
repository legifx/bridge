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
  },
  "problems": [ <1 to 3 real, solvable practice problems> ]
}

Each problem is ONE of these shapes, chosen to fit the subject:
- Quantitative subject (math, physics, chemistry, finance): a "numeric" problem the learner computes.
  { "type":"numeric", "prompt":"A 3 kg cart accelerates at 4 m/s². What net force acts on it?",
    "answer":12, "tolerance":0.1, "unit":"N", "solution":"F = m·a = 3·4 = 12 N" }
- Recognition / applied choice: an "mcq" problem.
  { "type":"mcq", "prompt":"…", "options":["…","…","…","…"], "answerIndex":2, "solution":"why option C is correct" }
- Applied reasoning that needs a short worked answer: an "open" problem.
  { "type":"open", "prompt":"…", "solution":"a concise model answer the response is graded against" }

Rules:
- Test understanding of the concept as defined by the source, not trivia. Strictly the subject's own vocabulary — never mention analogies/hobbies.
- Generate REAL problems that must actually be solved (a calculation, a worked application), not just definition recall. For a math/physics/chemistry concept, PREFER at least one "numeric" problem with a correct, verifiable answer.
- numeric: "answer" is the exact numeric result; set a sensible "tolerance"; include the "unit" if any. The problem must be fully solvable from the numbers given in the prompt.
- The MCQ (top-level and any mcq problem) must have exactly 4 options and one correct answerIndex (0-3); distractors plausible and subject-relevant.
- "solution" is always a short, correct worked explanation.`;

export const GRADE_SYSTEM = `You grade a learner's free-recall answer against the authoritative definition and source quote for a concept. Judge only whether the answer captures the concept correctly.

Return ONLY a JSON object:
{ "correct": true, "confident": true, "feedback": "one short sentence of feedback" }

Rules:
- correct = true if the answer captures the core idea, even if worded differently.
- confident = true only if the answer is clearly right (used to tune spaced repetition).
- Do not require exact wording. Do not reward fluent but wrong answers.`;

export const OPEN_GRADE_SYSTEM = `You grade learners' answers to worked practice problems. For each problem you get the model answer (correct solution) and the learner's answer. Judge whether the learner's answer is essentially correct.

Return ONLY a JSON object:
{ "results": [ { "correct": true, "feedback": "one short sentence" }, … ] }  // one entry per problem, in order

Rules:
- correct = true if the learner's answer reaches the right result / conclusion, even if worded or formatted differently. Accept equivalent numbers, units, and phrasings.
- Judge the actual problem-solving, not fluency. A confident but wrong answer is not correct.
- Keep each feedback to one short, specific sentence.`;

export const QUIZ_VERSION = "quiz@2";
export const GRADE_VERSION = "grade@1";
