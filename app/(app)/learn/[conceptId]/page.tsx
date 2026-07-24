"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { BridgeViz } from "@/components/BridgeViz";
import { LearnWidgets } from "@/components/LearnWidgets";
import { ThinkingLoader } from "@/components/ThinkingLoader";
import { FlowSteps } from "@/components/FlowSteps";
import { useT } from "@/components/LanguageProvider";
import type { Widget } from "@/lib/learn/widgets";

type Concept = {
  id: string;
  label: string;
  definition: string;
  sourceQuote: string;
  /** demo budget: already paid for, so re-opening this aspect costs nothing */
  charged: boolean;
};
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
  /** the widgets are generated separately and arrive a few seconds later */
  widgetsPending?: boolean;
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
  /** null until we know; true = starting an explanation would spend AI budget */
  const [costsBudget, setCostsBudget] = useState<boolean | null>(null);
  /** have we looked for a previously generated explanation yet? */
  const [cacheChecked, setCacheChecked] = useState(false);
  const [widgetsLoading, setWidgetsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => {
        const c: Concept | null = d.concepts?.find((x: Concept) => x.id === conceptId) ?? null;
        setConcept(c);
        setDomains(d.domains ?? []);
        setCostsBudget(Boolean(d.demo) && !c?.charged);
      });
  }, [conceptId]);

  // Re-learn entry (?relearn=1 from the review log): read straight from the URL
  // — it is already state, so mirroring it into React state would only add a
  // render pass and a chance to disagree with the address bar.
  const relearn = useSearchParams().get("relearn") === "1";

  // Was this aspect explained before? Then show THAT explanation — instantly,
  // free, and identical to what the learner remembers reading. Re-generating on
  // every visit spent money and time to produce a different text than the one
  // they came back for.
  useEffect(() => {
    // …unless this is an explicit re-learn, which exists precisely to produce a
    // NEW explanation aimed at last time's mistakes.
    if (relearn) return;
    let cancelled = false;
    fetch(`/api/bridge?conceptId=${encodeURIComponent(conceptId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.bridge) return;
        setBridge(d.bridge);
        if (d.bridge.widgetsPending) loadWidgets(d.bridge.bridgeId);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCacheChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [conceptId, relearn]);

  // Opening an aspect IS the request for its explanation, so it starts on its
  // own — the extra tap only delayed a wait the learner had already accepted.
  // The one exception is the public demo, where the first explanation for an
  // aspect spends part of a small budget: nobody should lose a unit to a
  // mis-tap, so there we still ask.
  useEffect(() => {
    // A re-learn never waits on the cache lookup — it skips it entirely.
    if (costsBudget === null || !(cacheChecked || relearn) || bridge || loadingBridge) return;
    if (relearn || !costsBudget) makeBridge(undefined, relearn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, relearn, costsBudget, cacheChecked]);

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
      // The explanation is on screen now; the widgets follow while it is read.
      if (data.widgetsPending && data.bridgeId) loadWidgets(data.bridgeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWrong"));
    } finally {
      setLoadingBridge(false);
    }
  }

  /** Fetch the interactive widgets for a bridge and drop them in when they land. */
  async function loadWidgets(bridgeId: string) {
    setWidgetsLoading(true);
    try {
      const res = await fetch("/api/bridge/widgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bridgeId }),
      });
      const data = await res.json();
      if (Array.isArray(data.visualizations) && data.visualizations.length > 0) {
        // Only touch the bridge this belongs to — the learner may have switched
        // interest while these were still being generated.
        setBridge((b) => (b && b.bridgeId === bridgeId ? { ...b, visualizations: data.visualizations } : b));
      }
    } catch {
      /* widgets are a bonus; a text-only explanation is a complete one */
    } finally {
      setWidgetsLoading(false);
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
        {/* the stepper stays put across the load, so it does not pop in late */}
        <FlowSteps current={1} />
        <p className="mt-16 text-center text-sm text-faint">{t("learn.loading")}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <FlowSteps current={1} />
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

        {/* Only the public demo still asks first — see the auto-start effect. */}
        {!bridge && !loadingBridge && costsBudget === true && (
          <div className="space-y-2">
            <button onClick={() => makeBridge()} className="btn btn-gradient w-full">
              {t("learn.explain")}
            </button>
            <p className="text-center text-xs text-faint">
              {t("learn.costsUnit")} · {t("learn.waitHint")}
            </p>
          </div>
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
            slowNote={t("learn.stillWorking")}
          />
        )}
        {error && (
          <div
            className="bg-[rgba(255,51,85,0.1)] p-4"
            style={{ borderRadius: "var(--r)" }}
            role="alert"
          >
            <p className="text-sm text-reject-text">{error}</p>
            {/* A failed generation is usually transient (busy provider, slow
                upstream) — offer the retry here instead of making the learner
                navigate away and back. */}
            <button
              onClick={() => makeBridge(undefined, relearn)}
              disabled={loadingBridge}
              className="btn btn-glass mt-3 w-full"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {/* Regenerating (interest switch / relearn): show the progress ABOVE the
            current explanation instead of replacing it. Switching interests out
            of curiosity used to blank the text mid-sentence for nine seconds. */}
        {bridge && loadingBridge && (
          <ThinkingLoader
            stages={[
              { label: t("learn.building"), detail: bridge.match.domainName },
              { label: t("learn.factChecker") },
            ]}
            glow="var(--interest)"
            expectedMs={9000}
            slowNote={t("learn.stillWorking")}
          />
        )}

        {bridge && (
          <div
            className={loadingBridge ? "pointer-events-none space-y-6 opacity-40 transition-opacity" : "space-y-6"}
            aria-busy={loadingBridge}
          >
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
            {/* …and a quiet placeholder while they are still being made, so they
                do not shove the page around unannounced. */}
            {widgetsLoading && !bridge.visualizations?.length && (
              <div className="card mt-6 p-5" aria-hidden>
                <div className="think-shimmer slabel text-faint">{t("learn.widgetsComing")}</div>
                <div className="mt-4 h-16 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
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

            {/* Feedback feeds the interest bandit — but it must stay OPTIONAL.
                Gating the way forward behind it made the rating the price of
                continuing, which is both a wall and bad data: whoever wants to
                move on taps whichever button unblocks them. */}
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
            <button
              onClick={() => router.push(`/learn/${conceptId}/check`)}
              className="btn btn-primary w-full"
            >
              {t("learn.check")}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
