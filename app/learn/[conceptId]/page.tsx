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
type Verdict = { verdict: "accept" | "revise" | "reject"; contradictions: { claim: string; reason: string }[]; analogyOverreach: boolean };
type Attempt = { attempt: number; body: Body; verdict: Verdict; status: "accepted" | "rejected"; isFallback?: boolean };
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
  const [result, setResult] = useState<null | { correct: boolean; mastery: number; nextIntervalDays: number; grade: { feedback: string } }>(null);
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
      <div className="space-y-4 px-2">
        {/* concept, plain, subject vocabulary, curriculum blue */}
        <header
          className="aura glass lit rounded-[--r-lg] p-5"
          style={{ "--glow": "var(--curriculum)", "--aura-x": "20%", "--aura-y": "30%", "--aura-strength": 0.6 } as React.CSSProperties}
        >
          <p className="font-mono text-2xs uppercase tracking-[0.3em] text-[#9dc0ff]">concept</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">{concept.label}</h1>
          <p className="mt-3 text-base leading-relaxed text-dim">{concept.definition}</p>
        </header>

        {!bridge && (
          <button
            onClick={makeBridge}
            disabled={loadingBridge}
            className="w-full rounded-full py-3.5 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: "linear-gradient(90deg,#3b7bff,#ff3bac)", boxShadow: "0 0 30px rgba(255,59,172,0.35)" }}
          >
            {loadingBridge ? "Building a bridge to your world…" : "Explain through my world"}
          </button>
        )}
        {error && <p className="rounded-[--r] bg-[rgba(255,51,85,0.1)] p-3 text-sm text-reject">{error}</p>}

        {bridge && (
          <>
            {/* rejected attempts — honest, red aura */}
            {rejected.map((a) => (
              <div
                key={a.attempt}
                className="aura glass rounded-[--r-lg] p-4"
                style={{ "--glow": "var(--reject)", "--aura-x": "80%", "--aura-y": "30%", "--aura-strength": 0.5 } as React.CSSProperties}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-2xs uppercase tracking-[0.2em] text-reject">
                    attempt {a.attempt} · rejected
                  </span>
                  <span className="font-mono text-2xs text-reject">{a.verdict.verdict}</span>
                </div>
                <p className="text-sm text-dim line-through decoration-reject/50">{a.body.opening}</p>
                <ul className="mt-2 space-y-1">
                  {a.verdict.contradictions.map((c, i) => (
                    <li key={i} className="text-xs text-[#ff8ba0]">
                      <span className="font-medium text-reject">{c.claim}</span> — {c.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {rejected.length > 0 && (
              <p className="text-center font-mono text-2xs uppercase tracking-[0.2em] text-faint">
                ↳ the fact-checker caught it — revised until accurate
              </p>
            )}

            {/* accepted bridge — signature viz */}
            {!bridge.isFallback ? (
              <>
                <BridgeViz
                  conceptLabel={concept.label}
                  domainName={bridge.match.domainName}
                  similarity={bridge.match.similarity}
                  correspondences={bridge.body.correspondences}
                />
                <p className="px-1 text-base leading-relaxed text-text">{bridge.body.opening}</p>

                {/* where it breaks down — amber */}
                <div
                  className="aura glass rounded-[--r-lg] p-4"
                  style={{ "--glow": "var(--orange)", "--aura-x": "80%", "--aura-y": "40%", "--aura-strength": 0.4 } as React.CSSProperties}
                >
                  <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[#ffb877]">where this analogy breaks down</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-dim">{bridge.body.breaksDown}</p>
                </div>
              </>
            ) : (
              <div className="glass rounded-[--r-lg] p-5">
                <p className="font-mono text-2xs uppercase tracking-[0.2em] text-faint">plain explanation · no analogy passed the fact-check</p>
                <p className="mt-2 text-base text-text">{bridge.body.plainRestatement}</p>
              </div>
            )}

            {/* plain subject restatement */}
            <div
              className="aura glass rounded-[--r] p-4"
              style={{ "--glow": "var(--curriculum)", "--aura-x": "15%", "--aura-y": "50%", "--aura-strength": 0.35 } as React.CSSProperties}
            >
              <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[#9dc0ff]">in plain subject terms</p>
              <p className="mt-1.5 text-sm leading-relaxed text-dim">{bridge.body.plainRestatement}</p>
            </div>

            {/* feedback -> Thompson */}
            {feedback === null ? (
              <div className="flex gap-3">
                <button
                  onClick={() => sendFeedback(true)}
                  className="flex-1 rounded-full py-3 text-sm font-semibold text-black"
                  style={{ background: "var(--acid)", boxShadow: "0 0 24px rgba(179,255,60,0.4)" }}
                >
                  That clicked
                </button>
                <button
                  onClick={() => sendFeedback(false)}
                  className="glass flex-1 rounded-full py-3 text-sm font-semibold text-text"
                >
                  Didn&rsquo;t land
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-faint">
                {feedback ? "Noted — we&rsquo;ll lean on this domain more." : "Noted — we&rsquo;ll try a different domain next time."}
              </p>
            )}

            {/* the check — subject vocabulary only */}
            {feedback !== null && !quiz && (
              <button onClick={startCheck} className="w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black">
                Check what stuck
              </button>
            )}

            {quiz && !result && (
              <div className="glass lit space-y-4 rounded-[--r-lg] p-5">
                <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[#9dc0ff]">
                  checked in the subject&rsquo;s own words — not the analogy
                </p>
                <div>
                  <p className="text-sm font-medium text-text">{quiz.free.prompt}</p>
                  <textarea
                    value={freeAnswer}
                    onChange={(e) => setFreeAnswer(e.target.value)}
                    rows={3}
                    placeholder="Answer in your own words…"
                    className="mt-2 w-full resize-y rounded-[--r] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-text outline-none ring-focus placeholder:text-faint"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{quiz.mcq.prompt}</p>
                  <div className="mt-2 space-y-2">
                    {quiz.mcq.options.map((o, i) => (
                      <button
                        key={i}
                        onClick={() => setMcqChoice(i)}
                        className="block w-full rounded-[--r] p-3 text-left text-sm transition"
                        style={{
                          background: mcqChoice === i ? "rgba(59,123,255,0.16)" : "rgba(255,255,255,0.04)",
                          boxShadow: mcqChoice === i ? "inset 0 0 0 1px rgba(59,123,255,0.4)" : undefined,
                          color: mcqChoice === i ? "#c9d6ff" : "var(--text)",
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={submitCheck}
                  disabled={mcqChoice === null || freeAnswer.trim().length === 0}
                  className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black disabled:opacity-30"
                >
                  Submit answers
                </button>
              </div>
            )}

            {result && (
              <div
                className="aura glass lit rounded-[--r-lg] p-6 text-center"
                style={{ "--glow": result.correct ? "var(--acid)" : "var(--orange)", "--aura-strength": 0.6 } as React.CSSProperties}
              >
                <p className={`text-lg font-semibold ${result.correct ? "text-[#c9ff7a]" : "text-[#ffb877]"}`}>
                  {result.correct ? "Got it." : "Not quite — worth another pass."}
                </p>
                <p className="mt-1 text-sm text-dim">{result.grade.feedback}</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Led value={`${Math.round(result.mastery * 100)}`} dot={4} color={result.correct ? "#c9ff7a" : "#ffb877"} />
                  <span className="font-mono text-2xs text-faint">% mastery · next review {result.nextIntervalDays}d</span>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-black"
                >
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
