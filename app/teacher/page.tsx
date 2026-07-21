"use client";

import { useEffect, useState } from "react";

type Row = {
  conceptLabel: string;
  attempts: number;
  correct: number;
  struggleRate: number;
  masteredCount: number;
};

export default function Teacher() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/teacher")
      .then((r) => r.json())
      .then((d) => setRows(d.concepts));
  }, []);

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 py-10">
      <header className="mb-2">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-curriculum">Teacher view</p>
        <h1 className="font-display text-3xl text-ink">Where the cohort struggles</h1>
      </header>
      <p className="mb-8 max-w-2xl rounded-[--radius] border-l-4 border-curriculum bg-curriculum-soft/40 p-3 text-sm text-ink">
        Bridge profiles material, not children. This view shows concept-level counts only — no student
        names, no individuals, and never anyone&rsquo;s interests.
      </p>

      {!rows && <p className="text-sm text-ink-soft">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="text-sm text-ink-soft">No cohort activity yet. Once learners answer checks, hardest concepts rank here.</p>
      )}

      {rows && rows.length > 0 && (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-soft">
              <th className="py-2 font-medium">Concept</th>
              <th className="py-2 text-right font-medium">Attempts</th>
              <th className="py-2 text-right font-medium">Correct</th>
              <th className="py-2 font-medium">Struggle</th>
              <th className="py-2 text-right font-medium">Mastered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.conceptLabel} className="border-b border-line/60">
                <td className="py-3 font-display text-base text-ink">{r.conceptLabel}</td>
                <td className="py-3 text-right font-mono text-ink-soft">{r.attempts}</td>
                <td className="py-3 text-right font-mono text-ink-soft">{r.correct}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-curriculum"
                        style={{ width: `${Math.round(r.struggleRate * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ink-soft">{Math.round(r.struggleRate * 100)}%</span>
                  </div>
                </td>
                <td className="py-3 text-right font-mono text-ink-soft">{r.masteredCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
