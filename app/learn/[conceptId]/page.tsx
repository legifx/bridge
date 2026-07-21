"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { BridgeViz } from "@/components/BridgeViz";

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

  async function sendFeedback(clicked: boolean) {
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
      body: JSON.stringify({
        conceptId,
        freeAnswer,
        mcqCorrect: mcqChoice === quiz.mcq.answerIndex,
      }),
    });
    setResult(await res.json());
  }

  if (!concept) {
    return (
      <Shell>
        <p className="mt-10 text-center text-sm text-ink-soft">Loading concept…</p>
      </Shell>
    );
  }

  const rejected = bridge?.attempts.filter((a) => a.status === "rejected") ?? [];

  return (
    <Shell>
      {/* concept, plain, always shown first and in subject vocabulary */}
      <header className="mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-curriculum">concept</p>
        <h1 className="font-display text-2xl text-ink">{concept.label}</h1>
        <p className="mt-2 rounded-[--radius] border-l-4 border-curriculum bg-curriculum-soft/40 p-3 text-base text-ink">
          {concept.definition}
        </p>
      </header>

      {!bridge && (
        <button
          onClick={makeBridge}
          disabled={loadingBridge}
          className="w-full rounded-[--radius] bg-interest py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {loadingBridge ? "Building a bridge to your world…" : "Explain through my world"}
        </button>
      )}
      {error && <p className="mt-4 rounded-[--radius] border border-bad/40 bg-bad/5 p-3 text-sm text-bad">{error}</p>}

      {bridge && (
        <div className="space-y-4">
          {/* rejected attempts shown honestly, with the verifier's reason */}
          {rejected.map((a) => (
            <div key={a.attempt} className="rounded-[--radius] border border-bad/40 bg-bad/5 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wide text-bad">
                  attempt {a.attempt} · rejected
                </span>
                <span className="font-mono text-xs text-bad">{a.verdict.verdict}</span>
              </div>
              <p className="text-sm text-ink line-through decoration-bad/40">{a.body.opening}</p>
              <ul className="mt-2 space-y-1">
                {a.verdict.contradictions.map((c, i) => (
                  <li key={i} className="text-xs text-bad">
                    <span className="font-medium">{c.claim}</span> — {c.reason}
                  </li>
                ))}
                {a.verdict.analogyOverreach && (
                  <li className="text-xs text-bad">The analogy implied something false about the subject.</li>
                )}
              </ul>
            </div>
          ))}
          {rejected.length > 0 && (
            <p className="text-center font-mono text-xs text-ink-soft">
              ↳ the verifier caught it, so we revised until it was accurate
            </p>
          )}

          {/* the accepted bridge — signature visualization */}
          {!bridge.isFallback ? (
            <>
              <BridgeViz
                conceptLabel={concept.label}
                domainName={bridge.match.domainName}
                similarity={bridge.match.similarity}
                correspondences={bridge.body.correspondences}
              />
              <p className="text-base text-ink">{bridge.body.opening}</p>
              <ul className="space-y-2">
                {bridge.body.correspondences.map((c, i) => (
                  <li key={i} className="rounded-[--radius] bg-paper-raised p-3 text-sm text-ink">
                    <span className="font-medium text-interest">{c.yourWorld}</span> {c.explanation}
                  </li>
                ))}
              </ul>
              <div className="rounded-[--radius] border border-warn/40 bg-warn/5 p-3">
                <p className="font-mono text-xs uppercase tracking-wide text-warn">where this analogy breaks down</p>
                <p className="mt-1 text-sm text-ink">{bridge.body.breaksDown}</p>
              </div>
            </>
          ) : (
            <div className="rounded-[--radius] border border-line bg-paper-raised p-4">
              <p className="font-mono text-xs text-ink-soft">plain explanation (no analogy passed the fact-check)</p>
              <p className="mt-1 text-base text-ink">{bridge.body.plainRestatement}</p>
            </div>
          )}

          {/* restated in subject vocabulary */}
          <div className="rounded-[--radius] border-l-4 border-curriculum bg-paper-raised p-3">
            <p className="font-mono text-xs uppercase tracking-wide text-curriculum">in plain subject terms</p>
            <p className="mt-1 text-sm text-ink">{bridge.body.plainRestatement}</p>
          </div>

          {/* feedback → Thompson sampling */}
          {feedback === null ? (
            <div className="flex gap-3">
              <button
                onClick={() => sendFeedback(true)}
                className="flex-1 rounded-[--radius] bg-curriculum py-2.5 text-sm font-medium text-white"
              >
                That clicked
              </button>
              <button
                onClick={() => sendFeedback(false)}
                className="flex-1 rounded-[--radius] border border-line bg-paper-raised py-2.5 text-sm font-medium text-ink"
              >
                Didn&rsquo;t land
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-ink-soft">
              {feedback ? "Noted — we&rsquo;ll lean on this domain more." : "Noted — we&rsquo;ll try a different domain next time."}
            </p>
          )}

          {/* the check — always in subject vocabulary */}
          {feedback !== null && !quiz && (
            <button onClick={startCheck} className="w-full rounded-[--radius] bg-curriculum py-3 text-sm font-medium text-white">
              Check what stuck
            </button>
          )}

          {quiz && !result && (
            <div className="space-y-4 rounded-[--radius] border border-line bg-paper-raised p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-curriculum">
                checked in the subject&rsquo;s own words — not the analogy
              </p>
              <div>
                <p className="text-sm font-medium text-ink">{quiz.free.prompt}</p>
                <textarea
                  value={freeAnswer}
                  onChange={(e) => setFreeAnswer(e.target.value)}
                  rows={3}
                  placeholder="Answer in your own words…"
                  className="mt-2 w-full resize-y rounded-[--radius] border border-line bg-paper p-3 text-sm text-ink outline-none focus:border-curriculum"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{quiz.mcq.prompt}</p>
                <div className="mt-2 space-y-2">
                  {quiz.mcq.options.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => setMcqChoice(i)}
                      className={`block w-full rounded-[--radius] border p-2.5 text-left text-sm ${
                        mcqChoice === i ? "border-curriculum bg-curriculum-soft" : "border-line bg-paper"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={submitCheck}
                disabled={mcqChoice === null || freeAnswer.trim().length === 0}
                className="w-full rounded-[--radius] bg-curriculum py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Submit answers
              </button>
            </div>
          )}

          {result && (
            <div className="rounded-[--radius] border border-line bg-paper-raised p-4 text-center">
              <p className={`font-display text-lg ${result.correct ? "text-ok" : "text-warn"}`}>
                {result.correct ? "Got it." : "Not quite — worth another pass."}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{result.grade.feedback}</p>
              <p className="mt-2 font-mono text-xs text-ink-soft">
                mastery {Math.round(result.mastery * 100)}% · next review in {result.nextIntervalDays}d
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 w-full rounded-[--radius] bg-curriculum py-2.5 text-sm font-medium text-white"
              >
                Back to map
              </button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
