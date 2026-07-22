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
    <main className="mx-auto w-full max-w-[640px] px-5 pb-52 pt-8">
      <header className="mb-8">
        <p className="eyebrow">Bridge</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
          What are you into?
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">
          Five taps. We use this to re-light new material through things you already
          understand — never to judge you.
        </p>
      </header>

      <div className="space-y-8">
        {QUESTIONS.map((q) => (
          <fieldset key={q.id}>
            <legend className="mb-3 text-base font-semibold tracking-tight text-text">
              {q.prompt}
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {q.options.map((o) => {
                const active = selected[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(q.id, o.id)}
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
          <label htmlFor="free" className="mb-3 block text-base font-semibold tracking-tight text-text">
            Anything else you&rsquo;re into right now?
          </label>
          <input
            id="free"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="drum & bass production, bouldering, vintage cameras…"
            maxLength={120}
            className="input"
          />
        </div>
      </div>

      {/* live profile bar */}
      <div
        className="fixed inset-x-0 z-40 px-5"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="card mx-auto max-w-[640px] p-4">
          <div className="mb-3 flex min-h-[26px] flex-wrap items-center gap-2">
            <span className="slabel text-faint">profile</span>
            {domains.length === 0 && <span className="text-xs text-faint">tap to begin…</span>}
            {domains.map((d) => (
              <span key={d} className="chip chip-interest pop">
                {d}
              </span>
            ))}
          </div>
          {error && <p className="mb-2 text-xs text-reject-text">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || (answered === 0 && !freeText.trim())}
            className="btn btn-primary w-full"
          >
            {busy ? "Building your profile…" : `Build my profile${answered ? ` · ${answered}/5` : ""}`}
          </button>
        </div>
      </div>
    </main>
  );
}
