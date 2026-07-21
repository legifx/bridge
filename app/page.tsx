"use client";

import { useState } from "react";
import { CHEM_SOURCE_TEXT } from "@/lib/demo/chem";

type GraphConcept = {
  id: string;
  label: string;
  definition: string;
  difficulty: number;
  prerequisiteIds: string[];
};
type Graph = {
  concepts: GraphConcept[];
  order: string[];
  hadCycle: boolean;
};

const STAGES = ["Reading page", "Extracting concepts", "Linking prerequisites"];

export default function Home() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setGraph(null);
    setStage(0);
    // Advance the visible stage labels while the request is in flight.
    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      700,
    );
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed.");
      setGraph(data.graph);
      setDemo(data.demoMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  }

  const byId = new Map(graph?.concepts.map((c) => [c.id, c]) ?? []);
  const ordered = graph ? graph.order.map((id) => byId.get(id)!).filter(Boolean) : [];

  return (
    <main className="mx-auto w-full max-w-[640px] px-5 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Bridge</p>
        <h1 className="font-display text-2xl leading-tight text-ink">
          Learn new things through what you already know.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Paste study material. Bridge turns it into a concept graph — not a summary — in the
          subject&rsquo;s own vocabulary.
        </p>
      </header>

      <section className="rounded-[--radius] border border-line bg-paper-raised p-4">
        <label htmlFor="src" className="mb-2 block text-sm font-medium text-ink">
          Study material
        </label>
        <textarea
          id="src"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a paragraph from your notes or textbook…"
          rows={7}
          className="w-full resize-y rounded-[--radius] border border-line bg-paper p-3 text-base text-ink outline-none focus:border-curriculum focus:ring-2 focus:ring-curriculum/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={busy || text.trim().length === 0}
            className="rounded-[--radius] bg-curriculum px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Working…" : "Extract concepts"}
          </button>
          <button
            onClick={() => setText(CHEM_SOURCE_TEXT)}
            disabled={busy}
            className="text-sm font-medium text-curriculum underline underline-offset-4 disabled:opacity-40"
          >
            Use demo chapter
          </button>
        </div>
      </section>

      {busy && (
        <ol className="mt-5 space-y-2" aria-live="polite">
          {STAGES.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  i < stage ? "bg-ok" : i === stage ? "bg-curriculum animate-pulse" : "bg-line"
                }`}
              />
              <span className={i <= stage ? "text-ink" : "text-ink-soft"}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p className="mt-5 rounded-[--radius] border border-bad/40 bg-bad/5 p-3 text-sm text-bad">
          {error}
        </p>
      )}

      {graph && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Learning order</h2>
            {demo && <span className="font-mono text-xs text-interest">demo mode · cached</span>}
          </div>
          {graph.hadCycle && (
            <p className="mb-3 text-xs text-warn">
              A prerequisite cycle was detected and broken so the order stays usable.
            </p>
          )}
          <ol className="space-y-3">
            {ordered.map((c, i) => (
              <li
                key={c.id}
                className="rounded-[--radius] border-l-4 border-curriculum bg-paper-raised p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-base text-ink">
                    <span className="mr-2 font-mono text-xs text-ink-soft">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {c.label}
                  </h3>
                  <span className="font-mono text-xs text-ink-soft">diff {c.difficulty}</span>
                </div>
                <p className="mt-1 text-sm text-ink">{c.definition}</p>
                {c.prerequisiteIds.length > 0 && (
                  <p className="mt-2 text-xs text-ink-soft">
                    needs: {c.prerequisiteIds.map((p) => byId.get(p)?.label ?? p).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
