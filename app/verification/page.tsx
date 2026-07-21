"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";

type Entry = {
  id: string;
  conceptLabel: string;
  domainName: string;
  status: "accepted" | "rejected";
  attempt: number;
  isFallback: boolean;
  verdict: { verdict: string; contradictions: { claim: string; reason: string }[]; analogyOverreach: boolean };
  preview: string;
};

export default function Verification() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/verification")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries));
  }, []);

  return (
    <Shell>
      <header className="mb-4">
        <h1 className="font-display text-2xl text-ink">Verification log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every bridge is fact-checked by a second, independent model against the source. Accepted and
          rejected attempts are both kept — honesty is the point.
        </p>
      </header>

      {!entries && <p className="mt-8 text-center text-sm text-ink-soft">Loading…</p>}
      {entries && entries.length === 0 && (
        <p className="mt-8 text-center text-sm text-ink-soft">
          No bridges yet. Learn a concept and its attempts show up here.
        </p>
      )}

      <ul className="space-y-3">
        {entries?.map((e) => {
          const rejected = e.status === "rejected";
          return (
            <li
              key={e.id}
              className={`rounded-[--radius] border p-3 ${
                rejected ? "border-bad/40 bg-bad/5" : "border-ok/30 bg-ok/5"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-display text-sm text-ink">
                  {e.conceptLabel}{" "}
                  <span className="font-body text-xs text-ink-soft">via {e.domainName}</span>
                </span>
                <span className={`font-mono text-xs ${rejected ? "text-bad" : "text-ok"}`}>
                  {e.isFallback ? "plain fallback" : e.status} · a{e.attempt}
                </span>
              </div>
              {e.preview && <p className="text-sm text-ink">{e.preview}</p>}
              {rejected &&
                e.verdict.contradictions.map((c, i) => (
                  <p key={i} className="mt-1 text-xs text-bad">
                    <span className="font-medium">{c.claim}</span> — {c.reason}
                  </p>
                ))}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
