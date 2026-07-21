"use client";

import { useEffect, useState } from "react";
import { Led } from "@/components/Led";

type Row = { conceptLabel: string; attempts: number; correct: number; struggleRate: number; masteredCount: number };

export default function Teacher() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/teacher")
      .then((r) => r.json())
      .then((d) => setRows(d.concepts));
  }, []);

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pb-16 pt-10">
      <header className="mb-3">
        <p className="font-mono text-2xs uppercase tracking-[0.3em] text-faint">Teacher</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">Where the cohort struggles</h1>
      </header>
      <div
        className="mb-8 aura glass rounded-[--r-lg] p-4"
        style={{ "--glow": "var(--curriculum)", "--aura-x": "12%", "--aura-y": "50%", "--aura-strength": 0.35 } as React.CSSProperties}
      >
        <p className="text-sm text-dim">
          <span className="font-semibold text-text">Bridge profiles material, not children.</span> Concept-level
          counts only — no student names, no individuals, and never anyone&rsquo;s interests.
        </p>
      </div>

      {!rows && <p className="text-sm text-faint">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="text-sm text-faint">No cohort activity yet. Once learners answer checks, hardest concepts rank here.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-[1fr_auto_1.4fr_auto] items-center gap-4 px-4 font-mono text-2xs uppercase tracking-[0.15em] text-faint">
            <span>Concept</span>
            <span className="text-right">Att</span>
            <span>Struggle</span>
            <span className="text-right">Mastered</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.conceptLabel}
              className="grid grid-cols-[1fr_auto_1.4fr_auto] items-center gap-4 rounded-[--r] bg-[rgba(255,255,255,0.035)] px-4 py-3.5"
            >
              <span className="text-base font-semibold tracking-tight text-text">{r.conceptLabel}</span>
              <span className="flex justify-end">
                <Led value={`${r.attempts}`} dot={3} color="#9dc0ff" />
              </span>
              <div className="flex items-center gap-3">
                <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(r.struggleRate * 100)}%`,
                      background: r.struggleRate > 0.5 ? "var(--reject)" : "var(--curriculum)",
                      boxShadow: "0 0 12px currentColor",
                      color: r.struggleRate > 0.5 ? "var(--reject)" : "var(--curriculum)",
                    }}
                  />
                </div>
                <span className="flex items-center gap-1">
                  <Led value={`${Math.round(r.struggleRate * 100)}`} dot={2.6} color={r.struggleRate > 0.5 ? "#ff8ba0" : "#9dc0ff"} />
                  <span className="font-mono text-2xs text-faint">%</span>
                </span>
              </div>
              <span className="flex justify-end">
                <Led value={`${r.masteredCount}`} dot={3} color="#c9ff7a" />
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
