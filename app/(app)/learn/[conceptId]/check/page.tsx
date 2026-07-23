"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Led } from "@/components/Led";
import { useT } from "@/components/LanguageProvider";

type Quiz = { free: { prompt: string }; mcq: { prompt: string; options: string[]; answerIndex: number } };
type Concept = { id: string; label: string; reviewEnabled: boolean };

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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    correct: boolean;
    mastery: number;
    nextIntervalDays: number;
    grade: { feedback: string };
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
    // generate the questions (1 AI unit)
    fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setQuiz(d.quiz);
      })
      .catch(() => setError(t("check.couldNotLoad")));
  }, [conceptId]);

  async function submit() {
    if (!quiz || mcqChoice === null) return;
    setSubmitting(true);
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId, freeAnswer, mcqCorrect: mcqChoice === quiz.mcq.answerIndex }),
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
            <textarea
              value={freeAnswer}
              onChange={(e) => setFreeAnswer(e.target.value)}
              rows={4}
              placeholder={t("check.freePlaceholder")}
              className="input mt-3 resize-y text-sm"
            />
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
              "--glow": result.correct ? "var(--acid)" : "var(--orange)",
              "--aura-strength": 0.5,
            } as React.CSSProperties
          }
        >
          <p
            className={`text-lg font-semibold tracking-tight ${
              result.correct ? "text-acid-text" : "text-orange-text"
            }`}
          >
            {result.correct ? t("check.gotIt") : t("check.notQuite")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-dim">{result.grade.feedback}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Led
              value={`${Math.round(result.mastery * 100)}`}
              dot={4}
              color={result.correct ? "#c9ff7a" : "#ffb877"}
              suffix="%"
            />
            <span className="slabel text-faint">{t("check.mastery", { d: result.nextIntervalDays })}</span>
          </div>

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
