"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { BridgeViz } from "@/components/BridgeViz";
import { Led } from "@/components/Led";

type Concept = { id: string; label: string; definition: string; sourceQuote: string };
type Body = {
  opening: string;
  correspondences: { subject: string; yourWorld: string; explanation: string }[];
  breaksDown: string;
  plainRestatement: string;
};
type Verdict = {
  verdict: "accept" | "revise" | "reject";
  contradictions: { claim: string; reason: string }[];
  analogyOverreach: boolean;
};
type Attempt = {
  attempt: number;
  body: Body;
  verdict: Verdict;
  status: "accepted" | "rejected";
  isFallback?: boolean;
};
type Match = { domainName: string; anchor: string; similarity: number };
type BridgeResp = { bridgeId: string; body: Body; match: Match; attempts: Attempt[]; isFallback: boolean };
type Quiz = { free: { prompt: string }; mcq: { prompt: string; options: string[]; answerIndex: number } };

export default function Learn() {
  const { conceptId } = useParams<{ conceptId: string }>();
  const router = useRouter();

  const [concept, setConcept] = useState<Concept | null>(null);
  const [bridge, setBridge] = useState<BridgeResp | null>(null);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [freeAnswer, setFreeAnswer] = useState("");
  const [mcqChoice, setMcqChoice] = useState<number | null>(null);
  const [result, setResult] = useState<null | {
    correct: boolean;
    mastery: number;
    nextIntervalDays: number;
    grade: { feedback: string };
  }>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => setConcept(d.concepts?.find((c: Concept) => c.id === conceptId) ?? null));
  }, [conceptId]);

  async function makeBridge() {
    setLoadingBridge(true);
    setError(null);
    try {
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conceptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build a bridge.");
      setBridge(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingBridge(false);
    }
  }

  function sendFeedback(clicked: boolean) {
    if (!bridge) return;
    setFeedback(clicked);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bridgeId: bridge.bridgeId, clicked }),
    });
  }

  async function startCheck() {
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId }),
    });
    const data = await res.json();
    setQuiz(data.quiz);
  }

  async function submitCheck() {
    if (!quiz || mcqChoice === null) return;
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId, freeAnswer, mcqCorrect: mcqChoice === quiz.mcq.answerIndex }),
    });
    setResult(await res.json());
  }

  if (!concept) {
    return (
      <Shell>
        <p className="mt-16 text-center text-sm text-faint">Loading concept…</p>
      </Shell>
    );
  }

  const rejected = bridge?.attempts.filter((a) => a.status === "rejected") ?? [];

  return (
    <Shell>
      <div className="space-y-5">
        {/* concept, plain, subject vocabulary — curriculum blue */}
        <header
          className="aura card p-6"
          style={
            {
              "--glow": "var(--curriculum)",
              "--aura-x": "15%",
              "--aura-y": "25%",
              "--aura-strength": 0.5,
            } as React.CSSProperties
          }
        >
          <p className="slabel text-curriculum-text">concept</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">{concept.label}</h1>
          <p className="mt-3 text-base leading-relaxed text-dim">{concept.definition}</p>
        </header>

        {!bridge && (
          <button onClick={makeBridge} disabled={loadingBridge} className="btn btn-gradient w-full">
            {loadingBridge ? "Building a bridge to your world…" : "Explain through my world"}
          </button>
        )}
        {error && (
          <p className="bg-[rgba(255,51,85,0.1)] p-4 text-sm text-reject-text" style={{ borderRadius: "var(--r)" }}>
            {error}
          </p>
        )}

        {bridge && (
          <>
            {/* rejected attempts — honest, red aura */}
            {rejected.map((a, idx) => (
              <div
                key={a.attempt}
                className="aura card reveal p-5"
                style={
                  {
                    "--glow": "var(--reject)",
                    "--aura-x": "85%",
                    "--aura-y": "25%",
                    "--aura-strength": 0.45,
                    animationDelay: `${idx * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="slabel text-reject">attempt {a.attempt} · rejected</span>
                  <span className="font-mono text-2xs text-reject">{a.verdict.verdict}</span>
                </div>
                <p className="text-sm leading-relaxed text-dim line-through decoration-reject/50">
                  {a.body.opening}
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {a.verdict.contradictions.map((c, i) => (
                    <li key={i} className="text-xs leading-relaxed text-reject-text">
                      <span className="font-medium text-reject">{c.claim}</span> — {c.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {rejected.length > 0 && (
              <p className="slabel reveal text-center text-faint" style={{ animationDelay: "120ms" }}>
                ↳ the fact-checker caught it — revised until accurate
              </p>
            )}

            {/* accepted bridge — signature viz */}
            {!bridge.isFallback ? (
              <>
                <div className="reveal" style={{ animationDelay: "180ms" }}>
                  <BridgeViz
                    conceptLabel={concept.label}
                    domainName={bridge.match.domainName}
                    similarity={bridge.match.similarity}
                    correspondences={bridge.body.correspondences}
                  />
                </div>
                <p className="reveal px-1 text-base leading-relaxed text-text" style={{ animationDelay: "280ms" }}>
                  {bridge.body.opening}
                </p>

                {/* where it breaks down — amber */}
                <div
                  className="aura card reveal p-5"
                  style={
                    {
                      "--glow": "var(--orange)",
                      "--aura-x": "85%",
                      "--aura-y": "35%",
                      "--aura-strength": 0.35,
                      animationDelay: "360ms",
                    } as React.CSSProperties
                  }
                >
                  <p className="slabel text-orange-text">where this analogy breaks down</p>
                  <p className="mt-2 text-sm leading-relaxed text-dim">{bridge.body.breaksDown}</p>
                </div>
              </>
            ) : (
              <div className="card p-5">
                <p className="slabel text-faint">plain explanation · no analogy passed the fact-check</p>
                <p className="mt-2 text-base leading-relaxed text-text">{bridge.body.plainRestatement}</p>
              </div>
            )}

            {/* plain subject restatement */}
            <div
              className="aura card reveal p-5"
              style={
                {
                  "--glow": "var(--curriculum)",
                  "--aura-x": "12%",
                  "--aura-y": "50%",
                  "--aura-strength": 0.3,
                  animationDelay: "440ms",
                } as React.CSSProperties
              }
            >
              <p className="slabel text-curriculum-text">in plain subject terms</p>
              <p className="mt-2 text-sm leading-relaxed text-dim">{bridge.body.plainRestatement}</p>
            </div>

            {/* feedback -> Thompson */}
            {feedback === null ? (
              <div className="reveal flex gap-3" style={{ animationDelay: "520ms" }}>
                <button onClick={() => sendFeedback(true)} className="btn btn-acid flex-1">
                  That clicked
                </button>
                <button onClick={() => sendFeedback(false)} className="btn btn-glass flex-1">
                  Didn&rsquo;t land
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-faint">
                {feedback
                  ? "Noted — we’ll lean on this domain more."
                  : "Noted — we’ll try a different domain next time."}
              </p>
            )}

            {/* the check — subject vocabulary only */}
            {feedback !== null && !quiz && (
              <button onClick={startCheck} className="btn btn-primary w-full">
                Check what stuck
              </button>
            )}

            {quiz && !result && (
              <div className="card space-y-5 p-5">
                <p className="slabel text-curriculum-text">
                  checked in the subject&rsquo;s own words — not the analogy
                </p>
                <div>
                  <p className="text-sm font-medium text-text">{quiz.free.prompt}</p>
                  <textarea
                    value={freeAnswer}
                    onChange={(e) => setFreeAnswer(e.target.value)}
                    rows={3}
                    placeholder="Answer in your own words…"
                    className="input mt-2.5 resize-y text-sm"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{quiz.mcq.prompt}</p>
                  <div className="mt-2.5 space-y-2">
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
                  onClick={submitCheck}
                  disabled={mcqChoice === null || freeAnswer.trim().length === 0}
                  className="btn btn-primary w-full"
                >
                  Submit answers
                </button>
              </div>
            )}

            {result && (
              <div
                className="aura card p-6 text-center"
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
                  {result.correct ? "Got it." : "Not quite — worth another pass."}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-dim">{result.grade.feedback}</p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <Led
                    value={`${Math.round(result.mastery * 100)}`}
                    dot={4}
                    color={result.correct ? "#c9ff7a" : "#ffb877"}
                    suffix="%"
                  />
                  <span className="slabel text-faint">mastery · next review {result.nextIntervalDays}d</span>
                </div>
                <button onClick={() => router.push("/")} className="btn btn-primary mt-6 w-full">
                  Back to map
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
