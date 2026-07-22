"use client";

import { useEffect, useState } from "react";
import { Led } from "@/components/Led";

type Row = {
  conceptLabel: string;
  attempts: number;
  correct: number;
  struggleRate: number;
  masteredCount: number;
};

const GRID = "grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1.35fr)_72px] items-center gap-4";

export default function Teacher() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/teacher")
      .then((r) => r.json())
      .then((d) => setRows(d.concepts));
  }, []);

  return (
    <main className="page-enter mx-auto w-full max-w-[880px] px-6 pb-24 pt-12">
      <header className="mb-8">
        <p className="eyebrow">Teacher</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
          Where the cohort struggles
        </h1>
      </header>

      <div
        className="aura card mb-10 p-6"
        style={
          {
            "--glow": "var(--curriculum)",
            "--aura-x": "8%",
            "--aura-y": "50%",
            "--aura-strength": 0.3,
          } as React.CSSProperties
        }
      >
        <p className="text-sm leading-relaxed text-dim">
          <span className="font-semibold text-text">Bridge profiles material, not children.</span>{" "}
          Concept-level counts only — no student names, no individuals, and never anyone&rsquo;s
          interests.
        </p>
      </div>

      {!rows && <p className="text-sm text-faint">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="text-sm text-faint">
          No cohort activity yet. Once learners answer checks, hardest concepts rank here.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className={`${GRID} px-6 py-4`}>
            <span className="slabel text-faint">Concept</span>
            <span className="slabel text-right text-faint">Att</span>
            <span className="slabel text-faint">Struggle</span>
            <span className="slabel text-right text-faint">Mastered</span>
          </div>
          {rows.map((r) => (
            <div key={r.conceptLabel} className={`${GRID} border-t border-hair px-6 py-5`}>
              <span className="truncate text-base font-semibold tracking-tight text-text">
                {r.conceptLabel}
              </span>
              <span className="flex justify-end">
                <Led value={`${r.attempts}`} dot={3} color="#9dc0ff" />
              </span>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(r.struggleRate * 100)}%`,
                      background: r.struggleRate > 0.5 ? "var(--reject)" : "var(--curriculum)",
                      boxShadow: "0 0 10px currentColor",
                      color: r.struggleRate > 0.5 ? "var(--reject)" : "var(--curriculum)",
                    }}
                  />
                </div>
                <Led
                  value={`${Math.round(r.struggleRate * 100)}`}
                  dot={2.6}
                  color={r.struggleRate > 0.5 ? "#ff8ba0" : "#9dc0ff"}
                  suffix="%"
                />
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
