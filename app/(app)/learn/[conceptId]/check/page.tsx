"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Grade } from "@/components/Grade";
import { MicButton } from "@/components/MicButton";
import { useT } from "@/components/LanguageProvider";
import type { Problem } from "@/lib/quiz";

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
export default function Check() {
  const t = useT();
  const { conceptId } = useParams<{ conceptId: string }>();
  const router = useRouter();

  const [concept, setConcept] = useState<Concept | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeAnswer, setFreeAnswer] = useState("");
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
    // generate the questions (1 AI unit). ?mode=tasks = the bigger practice set.
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
          setResponses((d.quiz?.problems ?? []).map(() => null));
        }
      })
      .catch(() => setError(t("check.couldNotLoad")));
  }, [conceptId]);

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
      <header className="mb-8 mt-2">
        <p className="eyebrow">{t("check.eyebrow")}</p>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-text">
          {concept?.label ?? "…"}
        </h1>
        <p className="mt-2.5 max-w-md text-sm leading-relaxed text-dim">{t("check.sub")}</p>
      </header>

      {error && (
        <div className="card p-5">
          <p className="text-sm text-reject-text">{error}</p>
          <button onClick={() => router.back()} className="btn btn-glass mt-4 w-full">
            {t("common.back")}
          </button>
        </div>
      )}

      {!quiz && !error && (
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
            <p className="text-sm font-medium text-text">{quiz.free.prompt}</p>
            <div className="mt-3 flex items-start gap-2">
              <textarea
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
            <p className="text-sm font-medium text-text">{quiz.mcq.prompt}</p>
            <div className="mt-3 space-y-2">
              {quiz.mcq.options.map((o, i) => (
                <button
                  key={i}
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
              <p className="text-sm font-medium text-text">{p.prompt}</p>
              {p.type === "numeric" && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
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
                <div className="mt-3 space-y-2">
                  {p.options.map((o, oi) => (
                    <button
                      key={oi}
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

          <button
            onClick={submit}
            disabled={submitting || mcqChoice === null || freeAnswer.trim().length === 0}
            className={`btn btn-primary w-full ${submitting ? "btn-working" : ""}`}
          >
            {submitting ? t("check.grading") : t("check.submit")}
          </button>
        </div>
      )}

      {result && (
        <div
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
            <div className="mt-6 space-y-2 text-left">
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
            className="mt-6 w-full rounded-full px-4 py-3 text-left text-sm transition"
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
