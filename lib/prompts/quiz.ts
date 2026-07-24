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
- BE SPECIFIC, NOT VAGUE: every question and problem must be pointed and self-contained. State exactly what to answer or compute, include all numbers/context needed, and make it obvious what a correct answer looks like. Avoid open, sweeping prompts like "Explain X" when a precise question ("What happens to Y when Z doubles?", "Compute the force for m=3kg, a=2m/s²") tests the same understanding more clearly. The learner should never wonder what kind of answer you expect.
- SCOPE — CRITICAL: test ONLY what THIS ONE concept's definition below actually covers. Do NOT ask about facts, numbers, or sub-topics that are not stated in the concept's definition, even if they belong to the broader subject or were on the same source page. The learner has only studied this one concept — a question they could not answer from this concept's own content is a failure. When in doubt, stay narrower.
- Test understanding of the concept as defined, not trivia. Strictly the subject's own vocabulary — never mention analogies/hobbies.
- Generate REAL problems that must actually be solved (a calculation, a worked application), not just definition recall — but each problem must be solvable purely from THIS concept's definition and the numbers in the problem itself. For a math/physics/chemistry concept, PREFER at least one "numeric" problem with a correct, verifiable answer.
- numeric: "answer" is the exact numeric result; set a sensible "tolerance"; include the "unit" if any. The problem must be fully solvable from the numbers given in the prompt.
- The MCQ (top-level and any mcq problem) must have exactly 4 options and one correct answerIndex (0-3); distractors plausible and subject-relevant.
- "solution" is always a short, correct worked explanation.`;

export const GRADE_SYSTEM = `You grade a learner's free-recall answer like a fair, experienced teacher marking by hand. You get the authoritative definition and the learner's answer. Judge whether the answer captures the concept — by MEANING, not by wording.

Return ONLY a JSON object:
{ "score": 0.0, "feedback": "one short, specific sentence" }

Rules:
- score is a FRACTION from 0.0 to 1.0 — partial credit, like a teacher. 1.0 = the core idea is correct (however it is phrased); 0.5-0.9 = partly right or missing a piece; 0.1-0.4 = mostly wrong; 0.0 = empty or entirely wrong.
- Grade the MEANING. An answer worded completely differently from the definition, even loosely or informally, is FULLY correct if it conveys the right idea. NEVER require the learner to match the definition's wording, terms, or phrasing. A learner who clearly understands but writes casually gets full marks.
- Do reward a correct idea in the learner's own words; do not reward fluent-sounding but wrong answers.
- feedback: say specifically what was right or what was missing, in one sentence.`;

export const OPEN_GRADE_SYSTEM = `You grade learners' answers to worked practice problems like a fair teacher. For each problem you get the model answer (correct solution) and the learner's answer. Award partial credit by MEANING.

Return ONLY a JSON object:
{ "results": [ { "score": 0.0, "feedback": "one short sentence" }, … ] }  // one entry per problem, in order

Rules:
- score is a FRACTION 0.0-1.0. 1.0 = reaches the right result/conclusion (however phrased or formatted); 0.5-0.9 = right approach but incomplete or a minor error; 0.1-0.4 = mostly wrong; 0.0 = empty or entirely wrong.
- Judge the MEANING and the actual problem-solving, not wording. Accept equivalent numbers, units, rounding, and phrasings; an answer in the learner's own words that is correct in substance gets full credit.
- Keep each feedback to one short, specific sentence.`;

export const QUIZ_VERSION = "quiz@2";
export const GRADE_VERSION = "grade@1";
