"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

  // Re-learn entry (?relearn=1 from the review log): read straight from the URL
  // — it is already state, so mirroring it into React state would only add a
  // render pass and a chance to disagree with the address bar.
  const relearn = useSearchParams().get("relearn") === "1";

  // …and auto-build a fresh explanation that targets what was missed last time.
  useEffect(() => {
    if (relearn) makeBridge(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, relearn]);

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
            <label
              className="relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-4"
              style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-interest-text">
                {bridge.match.domainName}
              </span>
              <svg aria-hidden width="10" height="6" viewBox="0 0 10 6" className="shrink-0 opacity-50">
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <select
                aria-label={t("learn.explainedVia")}
                value={domains.find((d) => d.name === bridge.match.domainName)?.id ?? ""}
                onChange={(e) => makeBridge(e.target.value)}
                disabled={loadingBridge}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {domains.map((d) => (
                  <option key={d.id} value={d.id} className="bg-black text-white">
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {loadingBridge && <span className="slabel text-interest-text">· {t("learn.building")}</span>}
          </div>
        )}

        {!bridge && !loadingBridge && (
          <button onClick={() => makeBridge()} className="btn btn-gradient w-full">
            {t("learn.explain")}
          </button>
        )}
        {!bridge && loadingBridge && (
          <ThinkingLoader
            stages={[
              { label: t("learn.preparing"), detail: t("learn.preparingDetail") },
              { label: t("learn.building") },
              { label: t("learn.factChecker") },
            ]}
            glow="var(--interest)"
            expectedMs={11000}
          />
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
