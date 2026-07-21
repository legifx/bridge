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

  // Domain chips form live as the learner answers — the mechanism feels alive.
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
    <main className="mx-auto w-full max-w-[640px] px-5 py-8 pb-40">
      <header className="mb-2">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-curriculum">Bridge</p>
        <h1 className="font-display text-2xl leading-tight text-ink">What are you into?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Five taps. We use this to explain new material through things you already understand — never
          to judge you.
        </p>
      </header>

      <div className="space-y-6">
        {QUESTIONS.map((q) => (
          <fieldset key={q.id}>
            <legend className="mb-2 font-display text-base text-ink">{q.prompt}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const active = selected[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(q.id, o.id)}
                    className={`rounded-[--radius] border p-3 text-left text-sm transition ${
                      active
                        ? "border-interest bg-interest-soft text-ink"
                        : "border-line bg-paper-raised text-ink hover:border-interest"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <label htmlFor="free" className="mb-2 block font-display text-base text-ink">
            Anything else you&rsquo;re into right now?
          </label>
          <input
            id="free"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="e.g. drum & bass production, bouldering, vintage cameras"
            maxLength={120}
            className="w-full rounded-[--radius] border border-line bg-paper p-3 text-base text-ink outline-none focus:border-interest focus:ring-2 focus:ring-interest/30"
          />
        </div>
      </div>

      {/* live profile forming */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper-raised/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-[640px]">
          <div className="mb-2 flex min-h-[26px] flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-soft">your profile:</span>
            {domains.length === 0 && <span className="text-xs text-ink-soft">tap to begin…</span>}
            {domains.map((d) => (
              <span
                key={d}
                className="chip rounded-full border border-interest bg-interest-soft px-2.5 py-0.5 text-xs font-medium text-interest"
              >
                {d}
              </span>
            ))}
          </div>
          {error && <p className="mb-2 text-xs text-bad">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || (answered === 0 && !freeText.trim())}
            className="w-full rounded-[--radius] bg-curriculum py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Building your profile…" : `Build my profile${answered ? ` (${answered}/5)` : ""}`}
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
