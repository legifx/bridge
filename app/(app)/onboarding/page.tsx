"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TickScale } from "@/components/TickScale";
import { StepCard } from "@/components/InterviewSteps";
import { ThinkingLoader } from "@/components/ThinkingLoader";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useI18n } from "@/components/LanguageProvider";
import type { Answer, Interaction, MirrorDomain } from "@/lib/onboarding/types";

/**
 * Onboarding v3 — an adaptive interview instead of a fixed form.
 *
 * language: chosen first (clean dropdown), drives the WHOLE app — UI strings
 *   and every AI-generated question/explanation.
 * seed: free chips + a discovery grid (broad areas that expand into specifics).
 * interview: server-driven steps (this-or-that, sliders, word magnets); the
 *   word magnet mixes real tiered terms with decoys, so depth is VERIFIED,
 *   not self-reported.
 * mirror: "here is what I understood" — editable, honest confidence.
 */

type Batch = {
  sessionId: string;
  phase: "drill" | "verify" | "mirror";
  steps: Interaction[];
  sync: number;
  profile?: MirrorDomain[];
  error?: string;
};

const MAX_SEEDS = 8;

export default function Onboarding() {
  const router = useRouter();
  const { t, dict, lang } = useI18n();
  const [phase, setPhase] = useState<"seed" | "interview" | "mirror">("seed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // discovery selections are keyed by grid position, so switching the
  // language mid-selection keeps every pick (labels re-render translated)
  const [broadSel, setBroadSel] = useState<Set<number>>(new Set());
  const [subSel, setSubSel] = useState<Set<string>>(new Set()); // "di:si"
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [customList, setCustomList] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

  // interview
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<Interaction[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [sync, setSync] = useState(0);

  // mirror
  const [profile, setProfile] = useState<MirrorDomain[]>([]);

  const seeds = useMemo(() => {
    const fromSubs = [...subSel].map((k) => {
      const [di, si] = k.split(":").map(Number);
      return dict.discovery[di]?.subs[si];
    });
    const subOf = (di: number) => [...subSel].some((k) => k.startsWith(`${di}:`));
    const fromBroad = [...broadSel].filter((di) => !subOf(di)).map((di) => dict.discovery[di]?.label);
    return [...customList, ...fromSubs, ...fromBroad].filter((s): s is string => Boolean(s)).slice(0, MAX_SEEDS);
  }, [broadSel, subSel, customList, dict]);

  function toggleBroad(di: number) {
    setBroadSel((s) => {
      const next = new Set(s);
      if (next.has(di)) next.delete(di);
      else next.add(di);
      return next;
    });
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(di)) next.delete(di);
      else next.add(di);
      return next;
    });
  }

  function toggleSub(key: string) {
    setSubSel((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addCustom() {
    const v = customInput.trim();
    if (v.length < 2 || customList.includes(v) || seeds.length >= MAX_SEEDS) return;
    setCustomList((l) => [...l, v]);
    setCustomInput("");
  }

  function applyBatch(batch: Batch) {
    setSessionId(batch.sessionId);
    setSync(batch.sync);
    if (batch.profile) {
      setProfile(batch.profile);
      setSync(1);
      setPhase("mirror");
      return;
    }
    setQueue(batch.steps);
    setIdx(0);
    setAnswers([]);
    setPhase("interview");
  }

  async function post(input: RequestInit & { url: string }): Promise<Batch | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(input.url, {
        ...input,
        headers: { "content-type": "application/json" },
      });
      if (res.status === 401) {
        window.location.href = "/signin?expired=1";
        return null;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("common.somethingWrong"));
      return data as Batch;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWrong"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const batch = await post({
      url: "/api/onboarding/session",
      method: "POST",
      body: JSON.stringify({ seeds, language: lang }),
    });
    if (batch) applyBatch(batch);
  }

  async function submitAnswers(all: Answer[]) {
    if (!sessionId) return;
    const batch = await post({
      url: "/api/onboarding/session",
      method: "PATCH",
      body: JSON.stringify({ sessionId, answers: all }),
    });
    if (batch) applyBatch(batch);
  }

  function onAnswer(a: Answer) {
    const all = [...answers, a];
    if (idx + 1 < queue.length) {
      setAnswers(all);
      setIdx(idx + 1);
    } else {
      setAnswers(all);
      void submitAnswers(all);
    }
  }

  async function removeDomain(id: string) {
    setProfile((p) => p.filter((d) => d.id !== id));
    await fetch("/api/onboarding/session", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "removeDomain", domainId: id }),
    }).catch(() => undefined);
  }

  const step = queue[idx];
  // The server only reports `sync` once per batch, so within a batch of
  // questions the meter would sit frozen. Nudge it forward per answered
  // question toward the next batch's value, so every tap visibly moves it.
  const displaySync =
    phase === "interview" && queue.length > 0
      ? Math.min(0.97, sync + (idx / queue.length) * 0.18)
      : sync;
  const depthLabel: Record<string, string> = {
    novice: t("ob.depth.casual"),
    hobbyist: t("ob.depth.hobbyist"),
    deep: t("ob.depth.deep"),
  };

  return (
    <main className="page-enter mx-auto w-full max-w-[640px] px-5 pb-56 pt-8">
      {phase === "seed" && busy && (
        <>
          <header className="mb-8">
            <p className="eyebrow">{t("ob.eyebrow")}</p>
          </header>
          <ThinkingLoader
            stages={[
              { label: t("ob.think1.a") },
              { label: t("ob.think1.b"), detail: t("ob.think1.bd") },
              { label: t("ob.think1.c") },
              { label: t("ob.think1.d"), detail: t("ob.think1.dd") },
            ]}
            items={seeds}
            glow="var(--interest)"
            expectedMs={9000}
          />
        </>
      )}

      {phase === "seed" && !busy && (
        <>
          <header className="mb-8">
            <p className="eyebrow">{t("ob.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
              {t("ob.seedTitle")}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">{t("ob.seedSub")}</p>
          </header>

          <div className="mb-8">
            <p className="mb-2 text-base font-semibold tracking-tight text-text">{t("ob.language")}</p>
            <p className="mb-3 text-xs leading-relaxed text-dim">{t("ob.languageSub")}</p>
            <LanguageSelect />
          </div>

          <div className="mb-8">
            <label htmlFor="own" className="mb-2 block text-base font-semibold tracking-tight text-text">
              {t("ob.own")}
            </label>
            <div className="flex gap-2.5">
              <input
                id="own"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder={t("ob.ownPlaceholder")}
                maxLength={80}
                className="input flex-1"
              />
              <button
                onClick={addCustom}
                disabled={customInput.trim().length < 2 || seeds.length >= MAX_SEEDS}
                className="btn btn-glass shrink-0 px-5"
              >
                {t("ob.add")}
              </button>
            </div>
            {customList.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {customList.map((v) => (
                  <button
                    key={v}
                    onClick={() => setCustomList((l) => l.filter((x) => x !== v))}
                    className="chip chip-interest pop"
                    title={t("ob.notMe")}
                  >
                    {v} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="slabel mb-3 text-faint">{t("ob.orExplore")}</p>
          <div className="space-y-3">
            {dict.discovery.map((d, di) => {
              const active = broadSel.has(di);
              const open = expanded.has(di);
              return (
                <div key={di}>
                  <button
                    type="button"
                    onClick={() => toggleBroad(di)}
                    className={`opt ring-focus w-full text-left ${active ? "opt-active" : ""}`}
                  >
                    {d.label}
                  </button>
                  {open && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-1">
                      {d.subs.map((sub, si) => {
                        const key = `${di}:${si}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleSub(key)}
                            className={`chip pop ring-focus ${subSel.has(key) ? "chip-interest" : ""}`}
                          >
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {phase === "interview" && (
        <>
          <header className="mb-8">
            <p className="eyebrow">
              {t("ob.interviewEyebrow")} · {Math.min(idx + 1, queue.length)}/{queue.length}
            </p>
          </header>
          {busy || !step ? (
            <ThinkingLoader
              stages={[
                { label: t("ob.think2.a") },
                { label: t("ob.think2.b"), detail: t("ob.think2.bd") },
                { label: t("ob.think2.c") },
                { label: t("ob.think2.d") },
              ]}
              items={[...new Set(queue.map((s) => s.domain))]}
              glow="var(--violet)"
              expectedMs={8000}
            />
          ) : (
            <StepCard step={step} onAnswer={onAnswer} />
          )}
          {error && (
            <div className="card mt-4 p-4">
              <p className="text-xs text-reject-text">{error}</p>
              <button onClick={() => void submitAnswers(answers)} className="btn btn-glass mt-3 px-5">
                {t("common.tryAgain")}
              </button>
            </div>
          )}
        </>
      )}

      {phase === "mirror" && (
        <>
          <header className="mb-8">
            <p className="eyebrow">{t("ob.mirrorEyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
              {t("ob.mirrorTitle")}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">{t("ob.mirrorSub")}</p>
          </header>
          <div className="space-y-4">
            {profile.map((d) => (
              <div key={d.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-text">{d.name}</p>
                    {d.tagline && <p className="mt-1 text-sm leading-relaxed text-dim">{d.tagline}</p>}
                  </div>
                  <button
                    onClick={() => void removeDomain(d.id)}
                    className="chip pop shrink-0"
                    title={t("ob.notMe")}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="chip chip-curriculum">{depthLabel[d.depth] ?? d.depth}</span>
                  {d.anchors.slice(0, 6).map((a) => (
                    <span key={a} className="chip chip-interest">
                      {a}
                    </span>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-2xs text-faint">
                    <span className="slabel">{t("ob.confidence")}</span>
                    <span>{Math.round(d.confidence * 100)}%</span>
                  </div>
                  <TickScale value={d.confidence} color="var(--interest)" count={36} />
                </div>
              </div>
            ))}
            {profile.length === 0 && (
              <div className="card p-6">
                <p className="text-sm text-dim">{t("ob.nothingLeft")}</p>
                <button onClick={() => window.location.reload()} className="btn btn-glass mt-3 px-5">
                  {t("ob.startOver")}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* action bar with the brain-sync meter */}
      <div
        className="fixed inset-x-0 z-40 px-5"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="nav-glass mx-auto max-w-[640px] p-4" style={{ borderRadius: "var(--r-lg)" }}>
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="slabel text-faint">{t("ob.brainSync")}</span>
              <span className="text-xs text-dim">{Math.round(displaySync * 100)}%</span>
            </div>
            <TickScale value={displaySync} color="var(--interest)" />
          </div>
          {phase === "seed" && (
            <>
              {error && <p className="mb-2 text-xs text-reject-text">{error}</p>}
              <button
                onClick={() => void start()}
                disabled={seeds.length === 0 || busy}
                className={`btn w-full ${busy ? "btn-working" : "btn-primary"}`}
              >
                {busy
                  ? t("ob.readingWorld")
                  : seeds.length === 0
                    ? t("ob.addOne")
                    : t("ob.startInterview", { n: seeds.length })}
              </button>
            </>
          )}
          {phase === "interview" && (
            <p className="text-center text-xs text-faint">{t("ob.honest")}</p>
          )}
          {phase === "mirror" && (
            <button
              onClick={() => router.push("/")}
              disabled={profile.length === 0}
              className="btn btn-primary w-full"
            >
              {t("ob.looksRight")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
