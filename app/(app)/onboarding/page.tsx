"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS, OPTION_BY_ID } from "@/lib/profile/questions";

type Intensity = "casual" | "into" | "deep";
const LEVELS: { key: Intensity; label: string; hint: string }[] = [
  { key: "casual", label: "Casual", hint: "I dip in sometimes" },
  { key: "into", label: "Into it", hint: "Part of my week" },
  { key: "deep", label: "Deep", hint: "I could talk for hours" },
];

/**
 * Onboarding v2 — nothing is mandatory. The tap groups are themed pools, not
 * forced choices: tap any number, skip whole groups, and add your own
 * interests. Then calibrate each one (casual / into it / deep) so a
 * least-bad pick never gets over-weighted.
 */
export default function Onboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customList, setCustomList] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [intensity, setIntensity] = useState<Record<string, Intensity>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(optId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(optId)) next.delete(optId);
      else next.add(optId);
      return next;
    });
  }

  function addCustom() {
    const t = customInput.trim();
    if (t.length < 2 || customList.includes(t) || customList.length >= 6) return;
    setCustomList((l) => [...l, t]);
    setCustomInput("");
  }

  // Collected "things" to calibrate in step 2: unique domains + custom texts.
  const collected = useMemo(() => {
    const domains = new Set<string>();
    selected.forEach((id) => {
      const o = OPTION_BY_ID[id];
      if (o) domains.add(o.domain);
    });
    return [...domains, ...customList];
  }, [selected, customList]);

  const total = collected.length;

  function goCalibrate() {
    // default everything to "into it" — the learner adjusts from there
    setIntensity((prev) => {
      const next: Record<string, Intensity> = {};
      collected.forEach((k) => (next[k] = prev[k] ?? "into"));
      return next;
    });
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const domainIntensity = (name: string): Intensity => intensity[name] ?? "into";
    const picks = [...selected].map((id) => ({
      id,
      intensity: domainIntensity(OPTION_BY_ID[id]?.domain ?? ""),
    }));
    const custom = customList.map((text) => ({ text, intensity: domainIntensity(text) }));
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ picks, custom }),
      });
      if (res.status === 401) {
        window.location.href = "/signin?expired=1";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build profile.");
      router.push("/capture");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="page-enter mx-auto w-full max-w-[640px] px-5 pb-56 pt-8">
      {step === 1 && (
        <>
          <header className="mb-10">
            <p className="eyebrow">Bridge · 1/2</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
              What are you into?
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">
              Tap anything that genuinely interests you — as many or as few as you like. Skip
              whole groups. If your thing isn&rsquo;t here, add it yourself below; that counts
              just as much.
            </p>
          </header>

          <div className="space-y-10">
            {QUESTIONS.map((q) => (
              <fieldset key={q.id}>
                <legend className="mb-3 text-base font-semibold tracking-tight text-text">
                  {q.prompt}
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const active = selected.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(o.id)}
                        className={`opt ring-focus ${active ? "opt-active" : ""}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div>
              <label
                htmlFor="own"
                className="mb-2 block text-base font-semibold tracking-tight text-text"
              >
                Your own interests
              </label>
              <p className="mb-3 max-w-md text-xs leading-relaxed text-faint">
                The best profiles come from here — the algorithm builds a custom domain for each
                one.
              </p>
              <div className="flex gap-2.5">
                <input
                  id="own"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                  placeholder="drum & bass production, bouldering, vintage cameras…"
                  maxLength={80}
                  className="input flex-1"
                />
                <button
                  onClick={addCustom}
                  disabled={customInput.trim().length < 2}
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
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <header className="mb-10">
            <p className="eyebrow">Bridge · 2/2</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
              How deep does each one go?
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">
              This is what keeps the profile honest: something you merely like starts light, and
              only grows if it actually works for you.
            </p>
          </header>

          <div className="space-y-4">
            {collected.map((name) => (
              <div key={name} className="card p-5">
                <p className="mb-3 text-base font-semibold tracking-tight text-text">{name}</p>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => {
                    const active = (intensity[name] ?? "into") === l.key;
                    return (
                      <button
                        key={l.key}
                        onClick={() => setIntensity((m) => ({ ...m, [name]: l.key }))}
                        className="rounded-[14px] px-2 py-2.5 text-center transition"
                        style={{
                          background: active ? "rgba(255,59,172,0.14)" : "rgba(255,255,255,0.045)",
                          boxShadow: active
                            ? "inset 0 0 0 1px rgba(255,59,172,0.45), 0 0 18px rgba(255,59,172,0.18)"
                            : "inset 0 1px 0 rgba(255,255,255,0.07)",
                        }}
                      >
                        <span
                          className={`block text-sm font-medium ${
                            active ? "text-interest-text" : "text-text"
                          }`}
                        >
                          {l.label}
                        </span>
                        <span className="mt-0.5 block text-2xs text-faint">{l.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* action bar */}
      <div
        className="fixed inset-x-0 z-40 px-5"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="nav-glass mx-auto max-w-[640px] p-4" style={{ borderRadius: "var(--r-lg)" }}>
          <div className="mb-3 flex min-h-[24px] flex-wrap items-center gap-2">
            <span className="slabel text-faint">profile</span>
            {total === 0 && <span className="text-xs text-faint">tap or add to begin…</span>}
            {collected.slice(0, 6).map((d) => (
              <span key={d} className="chip chip-interest pop">
                {d}
              </span>
            ))}
            {total > 6 && <span className="text-xs text-faint">+{total - 6}</span>}
          </div>
          {error && <p className="mb-2 text-xs text-reject-text">{error}</p>}
          {step === 1 ? (
            <button onClick={goCalibrate} disabled={total === 0} className="btn btn-primary w-full">
              {total === 0
                ? "Pick or add at least one"
                : `Calibrate ${total} interest${total === 1 ? "" : "s"} →`}
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} disabled={busy} className="btn btn-glass px-5">
                ←
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className={`btn flex-1 ${busy ? "btn-working" : "btn-primary"}`}
              >
                {busy ? "building your profile — embedding your world…" : "Start learning"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
