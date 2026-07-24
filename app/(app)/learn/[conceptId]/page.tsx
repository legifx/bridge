"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { BridgeViz } from "@/components/BridgeViz";
import { LearnWidgets } from "@/components/LearnWidgets";
import { ThinkingLoader } from "@/components/ThinkingLoader";
import { useT } from "@/components/LanguageProvider";
import type { Widget } from "@/lib/learn/widgets";

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
type BridgeResp = {
  bridgeId: string;
  body: Body;
  match: Match;
  attempts: Attempt[];
  isFallback: boolean;
  visualizations?: Widget[];
};

export default function Learn() {
  const t = useT();
  const { conceptId } = useParams<{ conceptId: string }>();
  const router = useRouter();

  const [concept, setConcept] = useState<Concept | null>(null);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [bridge, setBridge] = useState<BridgeResp | null>(null);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => {
        setConcept(d.concepts?.find((c: Concept) => c.id === conceptId) ?? null);
        setDomains(d.domains ?? []);
      });
  }, [conceptId]);

  const [relearn, setRelearn] = useState(false);

  // Re-learn entry (?relearn=1 from the review log): auto-build a fresh
  // explanation that targets what was missed last time.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("relearn") === "1") {
      setRelearn(true);
      makeBridge(undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  async function makeBridge(domainId?: string, doRelearn?: boolean) {
    setLoadingBridge(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conceptId,
          ...(domainId ? { domainId } : {}),
          ...(doRelearn ? { relearn: true } : {}),
        }),
      });
      if (res.status === 401) {
        window.location.href = "/signin?expired=1";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("learn.couldNotBuild"));
      setBridge(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWrong"));
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



  if (!concept) {
    return (
      <Shell>
        <p className="mt-16 text-center text-sm text-faint">{t("learn.loading")}</p>
      </Shell>
    );
  }

  const rejected = bridge?.attempts.filter((a) => a.status === "rejected") ?? [];

  return (
    <Shell>
      <div className="space-y-6">
        {/* concept, plain, subject vocabulary — curriculum blue */}
        <header
          className="aura card p-7"
          style={
            {
              "--glow": "var(--curriculum)",
              "--aura-x": "15%",
              "--aura-y": "25%",
              "--aura-strength": 0.5,
            } as React.CSSProperties
          }
        >
          <p className="slabel text-curriculum-text">{t("learn.concept")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">{concept.label}</h1>
          <p className="mt-3 text-base leading-relaxed text-dim">{concept.definition}</p>
          {relearn && <p className="mt-3 slabel text-interest-text">↺ {t("learn.relearnNote")}</p>}
        </header>

        {/* interest selector at the TOP — switch which interest explains this */}
        {bridge && domains.length > 1 && (
          <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
            <span className="slabel text-faint">{t("learn.explainedVia")}</span>
            <select
              value={domains.find((d) => d.name === bridge.match.domainName)?.id ?? ""}
              onChange={(e) => makeBridge(e.target.value)}
              disabled={loadingBridge}
              className="input h-9 max-w-[220px] py-0 text-sm"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {loadingBridge && <span className="slabel text-interest-text">· {t("learn.building")}</span>}
          </div>
        )}

        {!bridge && (
          <button
            onClick={() => makeBridge()}
            disabled={loadingBridge}
            className={`btn w-full ${loadingBridge ? "btn-working" : "btn-gradient"}`}
          >
            {loadingBridge ? t("learn.building") : t("learn.explain")}
          </button>
        )}
        {error && (
          <p className="bg-[rgba(255,51,85,0.1)] p-4 text-sm text-reject-text" style={{ borderRadius: "var(--r)" }}>
            {error}
          </p>
        )}

        {/* regenerating (interest switch / relearn): show progress, not stale content */}
        {bridge && loadingBridge && (
          <ThinkingLoader
            stages={[
              { label: t("learn.building"), detail: bridge.match.domainName },
              { label: t("learn.factChecker") },
            ]}
            glow="var(--interest)"
            expectedMs={9000}
          />
        )}

        {bridge && !loadingBridge && (
          <>
            {/* rejected attempts — honest, red aura */}
            {rejected.map((a, idx) => (
              <div
                key={a.attempt}
                className="aura card reveal p-6"
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
                  <span className="slabel text-reject">{t("learn.attempt", { n: a.attempt })}</span>
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
                {t("learn.factChecker")}
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
                  className="aura card reveal p-6"
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
                  <p className="slabel text-orange-text">{t("learn.breaksDown")}</p>
                  <p className="mt-2 text-sm leading-relaxed text-dim">{bridge.body.breaksDown}</p>
                </div>
              </>
            ) : (
              <div className="card p-6">
                <p className="slabel text-faint">{t("learn.plainNoAnalogy")}</p>
                <p className="mt-2 text-base leading-relaxed text-text">{bridge.body.plainRestatement}</p>
              </div>
            )}

            {/* interactive/visual widgets the agent chose for this concept */}
            {bridge.visualizations && bridge.visualizations.length > 0 && (
              <div className="reveal" style={{ animationDelay: "420ms" }}>
                <LearnWidgets widgets={bridge.visualizations} />
              </div>
            )}


            {/* plain subject restatement */}
            <div
              className="aura card reveal p-6"
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
              <p className="slabel text-curriculum-text">{t("learn.plainTerms")}</p>
              <p className="mt-2 text-sm leading-relaxed text-dim">{bridge.body.plainRestatement}</p>
            </div>

            {/* feedback -> Thompson */}
            {feedback === null ? (
              <div className="reveal flex gap-3" style={{ animationDelay: "520ms" }}>
                <button onClick={() => sendFeedback(true)} className="btn btn-acid flex-1">
                  {t("learn.clicked")}
                </button>
                <button onClick={() => sendFeedback(false)} className="btn btn-glass flex-1">
                  {t("learn.didntLand")}
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-faint">
                {feedback ? t("learn.notedLean") : t("learn.notedDifferent")}
              </p>
            )}

            {/* the check lives on its own page: recall from memory, no scrolling back */}
            {feedback !== null && (
              <button
                onClick={() => router.push(`/learn/${conceptId}/check`)}
                className="btn btn-primary w-full"
              >
                {t("learn.check")}
              </button>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
