"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TickScale } from "@/components/TickScale";
import { StepCard } from "@/components/InterviewSteps";
import type { Answer, Interaction, MirrorDomain } from "@/lib/onboarding/types";

/**
 * Onboarding v3 — an adaptive interview instead of a fixed form.
 *
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

const DISCOVERY: { label: string; subs: string[] }[] = [
  { label: "Gaming", subs: ["competitive shooters", "strategy games", "Minecraft & building games", "speedrunning", "game design"] },
  { label: "Music", subs: ["playing an instrument", "music production", "DJing", "singing"] },
  { label: "Sports & fitness", subs: ["football", "basketball", "gym & lifting", "running", "skating"] },
  { label: "PC & tech", subs: ["building PCs", "AI & machine learning", "coding", "gadgets"] },
  { label: "Cars & engines", subs: ["car mechanics", "tuning", "motorsport", "motorcycles"] },
  { label: "Making & building", subs: ["woodworking", "3D printing", "LEGO & models", "electronics"] },
  { label: "Cooking & baking", subs: ["cooking", "baking bread", "coffee brewing", "street food"] },
  { label: "Animals & nature", subs: ["horses", "dogs", "fishing", "hiking & camping"] },
  { label: "Art & design", subs: ["drawing", "digital art", "photography", "fashion"] },
  { label: "Film & stories", subs: ["movies & series", "anime & manga", "books & writing"] },
  { label: "Creating online", subs: ["YouTube & streaming", "video editing", "podcasts"] },
  { label: "Science & space", subs: ["astronomy", "physics", "math puzzles"] },
];

const DEPTH_LABEL: Record<string, string> = { novice: "casual", hobbyist: "hobbyist", deep: "deep" };

export default function Onboarding() {
  const router = useRouter();
  const [phase, setPhase] = useState<"seed" | "interview" | "mirror">("seed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // seed screen
  const [broadSel, setBroadSel] = useState<Set<string>>(new Set());
  const [subSel, setSubSel] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
    const fromSubs = [...subSel];
    const subOf = (broad: string) =>
      DISCOVERY.find((d) => d.label === broad)?.subs.some((s) => subSel.has(s)) ?? false;
    const fromBroad = [...broadSel].filter((b) => !subOf(b));
    return [...customList, ...fromSubs, ...fromBroad].slice(0, MAX_SEEDS);
  }, [broadSel, subSel, customList]);

  function toggleBroad(label: string) {
    setBroadSel((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function toggleSub(label: string) {
    setSubSel((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function addCustom() {
    const t = customInput.trim();
    if (t.length < 2 || customList.includes(t) || seeds.length >= MAX_SEEDS) return;
    setCustomList((l) => [...l, t]);
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
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      return data as Batch;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const batch = await post({ url: "/api/onboarding/session", method: "POST", body: JSON.stringify({ seeds }) });
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

  return (
    <main className="page-enter mx-auto w-full max-w-[640px] px-5 pb-56 pt-8">
      {phase === "seed" && (
        <>
          <header className="mb-8">
            <p className="eyebrow">Bridge · your world</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
              What do you care about?
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">
              Type your own things — that&rsquo;s the strongest signal — or tap around the grid.
              A short interview then figures out how deep each one really goes. No fixed
              categories, no wrong answers.
            </p>
          </header>

          <div className="mb-8">
            <label htmlFor="own" className="mb-2 block text-base font-semibold tracking-tight text-text">
              Your own interests
            </label>
            <div className="flex gap-2.5">
              <input
                id="own"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="drum & bass production, bouldering, local LLMs…"
                maxLength={80}
                className="input flex-1"
              />
              <button
                onClick={addCustom}
                disabled={customInput.trim().length < 2 || seeds.length >= MAX_SEEDS}
                className="btn btn-glass shrink-0 px-5"
              >
                Add
              </button>
            </div>
            {customList.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {customList.map((t) => (
                  <button
                    key={t}
                    onClick={() => setCustomList((l) => l.filter((x) => x !== t))}
                    className="chip chip-interest pop"
                    title="Remove"
                  >
                    {t} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="slabel mb-3 text-faint">or explore</p>
          <div className="space-y-3">
            {DISCOVERY.map((d) => {
              const active = broadSel.has(d.label);
              const open = expanded.has(d.label);
              return (
                <div key={d.label}>
                  <button
                    type="button"
                    onClick={() => toggleBroad(d.label)}
                    className={`opt ring-focus w-full text-left ${active ? "opt-active" : ""}`}
                  >
                    {d.label}
                  </button>
                  {open && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-1">
                      {d.subs.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSub(s)}
                          className={`chip pop ring-focus ${subSel.has(s) ? "chip-interest" : ""}`}
                        >
                          {s}
                        </button>
                      ))}
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
              Bridge · interview · {Math.min(idx + 1, queue.length)}/{queue.length}
            </p>
          </header>
          {busy || !step ? (
            <div className="card p-8 text-center">
              <p className="text-base font-medium text-text">Reading your world…</p>
              <p className="mt-1.5 text-sm text-dim">
                Building the next questions from what you just said.
              </p>
            </div>
          ) : (
            <StepCard step={step} onAnswer={onAnswer} />
          )}
          {error && (
            <div className="card mt-4 p-4">
              <p className="text-xs text-reject-text">{error}</p>
              <button onClick={() => void submitAnswers(answers)} className="btn btn-glass mt-3 px-5">
                Try again
              </button>
            </div>
          )}
        </>
      )}

      {phase === "mirror" && (
        <>
          <header className="mb-8">
            <p className="eyebrow">Bridge · your brain, mirrored</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
              Here&rsquo;s what I understood
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">
              Every confidence below was earned in the interview, not assumed. Remove anything
              that feels wrong — the rest keeps calibrating as you learn.
            </p>
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
                    title="Not me — remove"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="chip chip-curriculum">{DEPTH_LABEL[d.depth] ?? d.depth}</span>
                  {d.anchors.slice(0, 6).map((a) => (
                    <span key={a} className="chip chip-interest">
                      {a}
                    </span>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-2xs text-faint">
                    <span className="slabel">confidence</span>
                    <span>{Math.round(d.confidence * 100)}%</span>
                  </div>
                  <TickScale value={d.confidence} color="var(--interest)" count={36} />
                </div>
              </div>
            ))}
            {profile.length === 0 && (
              <div className="card p-6">
                <p className="text-sm text-dim">
                  Nothing left — restart the interview to rebuild your profile.
                </p>
                <button onClick={() => window.location.reload()} className="btn btn-glass mt-3 px-5">
                  Start over
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
              <span className="slabel text-faint">brain sync</span>
              <span className="text-xs text-dim">{Math.round(sync * 100)}%</span>
            </div>
            <TickScale value={sync} color="var(--interest)" />
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
                  ? "reading your world…"
                  : seeds.length === 0
                    ? "Add or tap at least one thing"
                    : `Start the interview · ${seeds.length} seed${seeds.length === 1 ? "" : "s"} →`}
              </button>
            </>
          )}
          {phase === "interview" && (
            <p className="text-center text-xs text-faint">
              Honest answers → better bridges. There is no score.
            </p>
          )}
          {phase === "mirror" && (
            <button
              onClick={() => router.push("/capture")}
              disabled={profile.length === 0}
              className="btn btn-primary w-full"
            >
              Looks right — start learning →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
