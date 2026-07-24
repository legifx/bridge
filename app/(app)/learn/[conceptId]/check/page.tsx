"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Grade } from "@/components/Grade";
import { MicButton } from "@/components/MicButton";
import { FlowSteps } from "@/components/FlowSteps";
import { useT } from "@/components/LanguageProvider";
import type { Problem } from "@/lib/quiz";
import type { MsgKey } from "@/lib/i18n";

type Quiz = {
  free: { prompt: string };
  mcq: { prompt: string; options: string[]; answerIndex: number };
  problems: Problem[];
};
type Concept = { id: string; label: string; reviewEnabled: boolean };
type ProblemResult = { correct: boolean; score?: number; earned?: number; max?: number; feedback?: string; solution: string };

/**
 * The check lives on its own page ON PURPOSE: active recall only works when
 * the explanation isn't one scroll away. Nothing from the learn session is
 * shown here — just the concept name and the questions, in subject vocabulary.
 */
type Draft = { freeAnswer: string; responses: (number | string | null)[] };

/** The saved-but-unsubmitted answers for a concept (never throws). */
function readDraft(conceptId: string): Draft {
  const empty: Draft = { freeAnswer: "", responses: [] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(`bridge.check-draft.${conceptId}`);
    if (!raw) return empty;
    const d = JSON.parse(raw) as Partial<Draft>;
    return {
      freeAnswer: typeof d.freeAnswer === "string" ? d.freeAnswer : "",
      responses: Array.isArray(d.responses) ? d.responses : [],
    };
  } catch {
    return empty; // a corrupt draft is simply no draft
  }
}

export default function Check() {
  const t = useT();
  const { conceptId } = useParams<{ conceptId: string }>();
  const router = useRouter();

  const [concept, setConcept] = useState<Concept | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<MsgKey | null>(null);
  // one message, whichever arrived: a server text or a translated local key

  const [freeAnswer, setFreeAnswer] = useState(() => readDraft(conceptId).freeAnswer);
  const [mcqChoice, setMcqChoice] = useState<number | null>(null);
  // one response slot per practice problem: number (numeric), index (mcq), or text (open)
  const [responses, setResponses] = useState<(number | string | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    score: number; // this check's grade, 0..1
    earned: number;
    total: number;
    passed: boolean;
    mastery: number;
    nextIntervalDays: number;
    grade: { feedback: string };
    problemResults?: ProblemResult[];
  }>(null);
  const [srs, setSrs] = useState<boolean | null>(null);
  // Draft answers from a previous visit. Read once, at first render — an effect
  // would have to write them into state, which costs an extra render pass and
  // can flash an empty field first.
  const saved = useRef<(number | string | null)[] | null>(null);
  if (saved.current === null) saved.current = readDraft(conceptId).responses;
  // whichever arrived: a message from the server, or a local key translated now
  const shownError = error ?? (errorKey ? t(errorKey) : null);
  // what still blocks submitting, as a message key (null = ready to submit)
  const noFree = freeAnswer.trim().length === 0;
  const noMcq = mcqChoice === null;
  const missing: MsgKey | null = noFree && noMcq
    ? "check.missingBoth"
    : noFree
      ? "check.missingFree"
      : noMcq
        ? "check.missingMcq"
        : null;

  // Typing a recall answer is real work, and a stray back-swipe or reload used
  // to erase it (and hand back a different question set). Keep the draft in
  // localStorage, keyed by concept, until the check is submitted.
  const draftKey = `bridge.check-draft.${conceptId}`;

  useEffect(() => {
    if (result) {
      window.localStorage.removeItem(draftKey); // submitted — the draft is spent
      return;
    }
    if (!freeAnswer.trim() && responses.every((r) => r === null || r === "")) return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ freeAnswer, responses }));
      } catch {
        /* private mode / quota — the draft is a convenience, never a requirement */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [draftKey, freeAnswer, responses, result]);

  /** Generate the question set. No state is touched synchronously here, so the
   *  mount effect can call it without kicking off a cascading render. */
  const loadQuiz = useCallback(() => {
    // ?mode=tasks = the bigger practice set from the review log.
    const tasksMode =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "tasks";
    fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId, ...(tasksMode ? { tasks: true } : {}) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setQuiz(d.quiz);
          // Restore a draft only where it still fits the freshly generated set.
          setResponses((d.quiz?.problems ?? []).map((_: unknown, i: number) => saved.current?.[i] ?? null));
        }
      })
      // Store a KEY, not a translated string: translating here would make `t` a
      // dependency, and a language switch would then regenerate the quiz for
      // nothing. Rendering translates it instead.
      .catch(() => setErrorKey("check.couldNotLoad"));
  }, [conceptId]);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => {
        if (r.status === 401) window.location.href = "/signin?expired=1";
        return r.json();
      })
      .then((d) => {
        const c = d.concepts?.find((x: Concept) => x.id === conceptId) ?? null;
        setConcept(c);
        if (c) setSrs(c.reviewEnabled);
      });
    loadQuiz();
  }, [conceptId, loadQuiz]);

  async function submit() {
    if (!quiz || mcqChoice === null) return;
    setSubmitting(true);
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conceptId,
        freeAnswer,
        mcqCorrect: mcqChoice === quiz.mcq.answerIndex,
        problems: quiz.problems.map((p, i) => ({ problem: p, response: responses[i] ?? null })),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) setError(data.error);
    else {
      setResult(data);
      // Answering auto-enrolls the concept in the rotation (server-side); mirror
      // that in the toggle so it reflects reality.
      if (typeof data.reviewEnabled === "boolean") setSrs(data.reviewEnabled);
    }
  }

  async function toggleSrs(enabled: boolean) {
    setSrs(enabled);
    fetch("/api/reviewplan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId, enabled }),
    });
  }

  return (
    <Shell>
      <FlowSteps current={result ? 3 : 2} />
      <header className="mb-8 mt-2">
        <p className="eyebrow">{t("check.eyebrow")}</p>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-text">
          {concept?.label ?? "…"}
        </h1>
        <p className="mt-2.5 max-w-md text-sm leading-relaxed text-dim">{t("check.sub")}</p>
      </header>

      {shownError && (
        <div className="card p-5" role="alert">
          <p className="text-sm text-reject-text">{shownError}</p>
          <div className="mt-4 flex gap-3">
            <button onClick={() => router.back()} className="btn btn-glass flex-1">
              {t("common.back")}
            </button>
            {/* Usually a busy or slow provider — retrying beats leaving. */}
            <button
              onClick={() => {
                setError(null);
                setErrorKey(null);
                setQuiz(null);
                loadQuiz();
              }}
              className="btn btn-primary flex-1"
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}

      {!quiz && !shownError && (
        <div className="card flex flex-col items-center gap-4 p-10">
          <span className="btn btn-working pointer-events-none h-10 px-5 text-xs">
            {t("check.writing")}
          </span>
          <p className="slabel text-faint">{t("check.generating")}</p>
        </div>
      )}

      {quiz && !result && (
        <div className="card space-y-6 p-6">
          <div>
            <p id="free-prompt" className="text-sm font-medium text-text">
              {quiz.free.prompt}
            </p>
            <div className="mt-3 flex items-start gap-2">
              <textarea
                aria-labelledby="free-prompt"
                value={freeAnswer}
                onChange={(e) => setFreeAnswer(e.target.value)}
                rows={4}
                placeholder={t("check.freePlaceholder")}
                className="input flex-1 resize-y text-sm"
              />
              <MicButton onText={(txt) => setFreeAnswer((p) => (p.trim() ? `${p} ${txt}` : txt))} />
            </div>
          </div>
          <div>
            <p id="mcq-prompt" className="text-sm font-medium text-text">
              {quiz.mcq.prompt}
            </p>
            {/* A choice is a radio group, not a row of unrelated buttons: screen
                readers announce "2 of 4 selected" and arrow keys work. */}
            <div className="mt-3 space-y-2" role="radiogroup" aria-labelledby="mcq-prompt">
              {quiz.mcq.options.map((o, i) => (
                <button
                  key={i}
                  role="radio"
                  aria-checked={mcqChoice === i}
                  onClick={() => setMcqChoice(i)}
                  className={`opt ${mcqChoice === i ? "opt-active-blue" : ""}`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* real practice problems — solve, not just recall */}
          {quiz.problems.map((p, i) => (
            <div key={i} className="border-t border-hair pt-5">
              <p className="slabel mb-2 text-curriculum-text">{t("check.task")}</p>
              <p id={`task-${i}`} className="text-sm font-medium text-text">
                {p.prompt}
              </p>
              {p.type === "numeric" && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-labelledby={`task-${i}`}
                    value={typeof responses[i] === "number" ? (responses[i] as number) : ""}
                    onChange={(e) =>
                      setResponses((r) => {
                        const n = [...r];
                        n[i] = e.target.value === "" ? null : Number(e.target.value);
                        return n;
                      })
                    }
                    placeholder={t("check.yourAnswer")}
                    className="input max-w-[180px] text-sm"
                  />
                  {p.unit && <span className="font-mono text-xs text-faint">{p.unit}</span>}
                </div>
              )}
              {p.type === "mcq" && (
                <div className="mt-3 space-y-2" role="radiogroup" aria-label={p.prompt}>
                  {p.options.map((o, oi) => (
                    <button
                      key={oi}
                      role="radio"
                      aria-checked={responses[i] === oi}
                      onClick={() =>
                        setResponses((r) => {
                          const n = [...r];
                          n[i] = oi;
                          return n;
                        })
                      }
                      className={`opt ${responses[i] === oi ? "opt-active-blue" : ""}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {p.type === "open" && (
                <div className="mt-3 flex items-start gap-2">
                  <textarea
                    aria-labelledby={`task-${i}`}
                    value={typeof responses[i] === "string" ? (responses[i] as string) : ""}
                    onChange={(e) =>
                      setResponses((r) => {
                        const n = [...r];
                        n[i] = e.target.value;
                        return n;
                      })
                    }
                    rows={3}
                    placeholder={t("check.yourAnswer")}
                    className="input flex-1 resize-y text-sm"
                  />
                  <MicButton
                    onText={(txt) =>
                      setResponses((r) => {
                        const n = [...r];
                        const cur = typeof n[i] === "string" ? (n[i] as string) : "";
                        n[i] = cur.trim() ? `${cur} ${txt}` : txt;
                        return n;
                      })
                    }
                  />
                </div>
              )}
            </div>
          ))}

          {/* A disabled button that will not say why is a dead end. Name what is
              still missing instead — the button stays enabled and the message
              points at the gap. */}
          <div>
            <button
              onClick={submit}
              disabled={submitting || missing !== null}
              className={`btn btn-primary w-full ${submitting ? "btn-working" : ""}`}
            >
              {submitting ? t("check.grading") : t("check.submit")}
            </button>
            {missing && !submitting && (
              <p className="mt-2 text-center text-xs text-faint">{t(missing)}</p>
            )}
          </div>
        </div>
      )}

      {result && (
        <div
          role="status"
          aria-live="polite"
          className="aura card p-7 text-center"
          style={
            {
              "--glow": result.passed ? "var(--acid)" : "var(--orange)",
              "--aura-strength": 0.5,
            } as React.CSSProperties
          }
        >
          {/* this check's grade — the headline, in the learner's country system */}
          <div className="flex items-center justify-center gap-3">
            <Grade score={result.score} dot={6} color={result.passed ? "#c9ff7a" : "#ffb877"} />
          </div>
          <p
            className={`mt-3 text-lg font-semibold tracking-tight ${
              result.passed ? "text-acid-text" : "text-orange-text"
            }`}
          >
            {result.passed ? t("check.gotIt") : t("check.notQuite")}
          </p>
          <p className="mt-1 font-mono text-2xs text-faint">
            {result.earned} / {result.total} {t("check.points")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-dim">{result.grade.feedback}</p>
          {/* long-term mastery + next review, secondary */}
          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="slabel text-faint">{t("check.masteryLabel")}</span>
            <Grade score={result.mastery} dot={2.6} color="#9dc0ff" />
            <span className="slabel text-faint">· {t("check.mastery", { d: result.nextIntervalDays })}</span>
          </div>

          {/* per-problem breakdown: what was right/wrong + the worked solution */}
          {result.problemResults && result.problemResults.length > 0 && (
            <div className="mt-6 space-y-2 text-start">
              {result.problemResults.map((pr, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={{
                    background: pr.correct ? "rgba(179,255,60,0.08)" : "rgba(255,184,119,0.08)",
                    boxShadow: `inset 0 0 0 1px ${pr.correct ? "rgba(179,255,60,0.25)" : "rgba(255,184,119,0.25)"}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="slabel text-faint">
                      {t("check.task")} {i + 1}
                    </span>
                    <span className={`slabel ${pr.correct ? "text-acid-text" : "text-orange-text"}`}>
                      {/* symbol as well as colour — colour alone is not a signal */}
                      <span aria-hidden>{pr.correct ? "✓ " : "✕ "}</span>
                      {pr.earned !== undefined && pr.max !== undefined
                        ? `${Math.round(pr.earned * 10) / 10} / ${pr.max} ${t("check.points")}`
                        : pr.correct
                          ? t("check.taskRight")
                          : t("check.taskWrong")}
                    </span>
                  </div>
                  {pr.feedback && <p className="mt-1 text-xs leading-relaxed text-dim">{pr.feedback}</p>}
                  <p className="mt-1.5 text-xs leading-relaxed text-faint">
                    <span className="text-curriculum-text">{t("check.solution")}:</span> {pr.solution}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* spaced repetition opt-in, per concept */}
          <button
            onClick={() => toggleSrs(!srs)}
            className="mt-6 w-full rounded-full px-4 py-3 text-start text-sm transition"
            style={{
              background: srs ? "rgba(179,255,60,0.1)" : "rgba(255,255,255,0.05)",
              boxShadow: srs
                ? "inset 0 0 0 1px rgba(179,255,60,0.35), 0 0 18px rgba(179,255,60,0.15)"
                : "inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <span className="flex items-center justify-between">
              <span className={srs ? "text-acid-text" : "text-dim"}>{t("check.keepRotation")}</span>
              <span className="slabel text-faint">{srs ? t("common.on") : t("common.off")}</span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-faint">{t("check.srsNote")}</span>
          </button>

          <button onClick={() => router.push("/")} className="btn btn-primary mt-5 w-full">
            {t("check.backToMap")}
          </button>
        </div>
      )}
    </Shell>
  );
}
