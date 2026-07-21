"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS, OPTION_BY_ID } from "@/lib/profile/questions";

export default function Onboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(qId: string, optId: string) {
    setSelected((s) => ({ ...s, [qId]: optId }));
  }

  const domains = useMemo(() => {
    const set = new Set<string>();
    Object.values(selected).forEach((id) => {
      const o = OPTION_BY_ID[id];
      if (o) set.add(o.domain);
    });
    return [...set];
  }, [selected]);

  const answered = Object.keys(selected).length;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectionIds: Object.values(selected), freeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build profile.");
      router.push("/capture");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[640px] px-5 pb-44 pt-8">
      <header className="mb-6">
        <p className="font-mono text-2xs uppercase tracking-[0.3em] text-faint">Bridge</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">What are you into?</h1>
        <p className="mt-2 max-w-md text-sm text-dim">
          Five taps. We use this to re-light new material through things you already understand —
          never to judge you.
        </p>
      </header>

      <div className="space-y-7">
        {QUESTIONS.map((q) => (
          <fieldset key={q.id}>
            <legend className="mb-3 text-base font-semibold text-text">{q.prompt}</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {q.options.map((o) => {
                const active = selected[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(q.id, o.id)}
                    className="aura glass block rounded-[--r] p-3.5 text-left text-sm transition ring-focus"
                    style={
                      {
                        "--glow": active ? "var(--interest)" : "transparent",
                        "--aura-x": "20%",
                        "--aura-y": "50%",
                        "--aura-strength": active ? 0.8 : 0,
                        color: active ? "#ffd9ee" : "var(--text)",
                        boxShadow: active
                          ? "inset 0 0 0 1px rgba(255,59,172,0.4), 0 0 24px rgba(255,59,172,0.25)"
                          : "inset 0 1px 0 0 rgba(255,255,255,0.08)",
                      } as React.CSSProperties
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <label htmlFor="free" className="mb-3 block text-base font-semibold text-text">
            Anything else you&rsquo;re into right now?
          </label>
          <input
            id="free"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="drum & bass production, bouldering, vintage cameras…"
            maxLength={120}
            className="w-full rounded-[--r] bg-[rgba(255,255,255,0.05)] px-4 py-3.5 text-base text-text outline-none ring-focus placeholder:text-faint"
          />
        </div>
      </div>

      {/* live profile bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
        <div className="glass lit mx-auto max-w-[640px] rounded-[--r-lg] p-4">
          <div className="mb-3 flex min-h-[24px] flex-wrap items-center gap-2">
            <span className="font-mono text-2xs uppercase tracking-[0.2em] text-faint">profile</span>
            {domains.length === 0 && <span className="text-xs text-faint">tap to begin…</span>}
            {domains.map((d) => (
              <span
                key={d}
                className="chip rounded-full bg-[rgba(255,59,172,0.14)] px-2.5 py-0.5 text-xs font-medium text-[#ffa6d8] shadow-[0_0_14px_rgba(255,59,172,0.3)]"
              >
                {d}
              </span>
            ))}
          </div>
          {error && <p className="mb-2 text-xs text-reject">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || (answered === 0 && !freeText.trim())}
            className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black transition disabled:opacity-30"
          >
            {busy ? "Building your profile…" : `Build my profile${answered ? ` · ${answered}/5` : ""}`}
          </button>
        </div>
      </div>

      <style jsx>{`
        .chip {
          animation: pop 0.25s ease;
        }
        @keyframes pop {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </main>
  );
}
