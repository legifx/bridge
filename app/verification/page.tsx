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
      <div className="px-2">
        <header className="mb-5 mt-2">
          <p className="font-mono text-2xs uppercase tracking-[0.3em] text-faint">Verification</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Every bridge, fact-checked</h1>
          <p className="mt-2 max-w-md text-sm text-dim">
            A second, independent model checks each analogy against the source. Accepted and rejected
            attempts are both kept — honesty is the point.
          </p>
        </header>

        {!entries && <p className="mt-10 text-center text-sm text-faint">Loading…</p>}
        {entries && entries.length === 0 && (
          <p className="mt-10 text-center text-sm text-faint">No bridges yet. Learn a concept and its attempts show up here.</p>
        )}

        <ul className="space-y-3">
          {entries?.map((e) => {
            const rejected = e.status === "rejected";
            return (
              <li
                key={e.id}
                className="aura glass rounded-[--r-lg] p-4"
                style={
                  {
                    "--glow": rejected ? "var(--reject)" : "var(--acid)",
                    "--aura-x": "82%",
                    "--aura-y": "30%",
                    "--aura-strength": 0.4,
                  } as React.CSSProperties
                }
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text">
                    {e.conceptLabel} <span className="font-mono text-2xs font-normal text-faint">via {e.domainName}</span>
                  </span>
                  <span className={`font-mono text-2xs uppercase tracking-[0.15em] ${rejected ? "text-reject" : "text-[#c9ff7a]"}`}>
                    {e.isFallback ? "plain" : e.status} · a{e.attempt}
                  </span>
                </div>
                {e.preview && <p className="text-sm text-dim">{e.preview}</p>}
                {rejected &&
                  e.verdict.contradictions.map((c, i) => (
                    <p key={i} className="mt-1 text-xs text-[#ff8ba0]">
                      <span className="font-medium text-reject">{c.claim}</span> — {c.reason}
                    </p>
                  ))}
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
