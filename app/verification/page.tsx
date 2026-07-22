"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";

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
      <PageHead
        eyebrow="Verification"
        title="Every bridge, fact-checked"
        sub="A second, independent model checks each analogy against the source. Accepted and rejected attempts are both kept — honesty is the point."
      />

      {!entries && <p className="mt-10 text-center text-sm text-faint">Loading…</p>}
      {entries && entries.length === 0 && (
        <p className="mt-10 text-center text-sm text-faint">
          No bridges yet. Learn a concept and its attempts show up here.
        </p>
      )}

      <ul className="space-y-5">
        {entries?.map((e) => {
          const rejected = e.status === "rejected";
          return (
            <li
              key={e.id}
              className="aura card p-6"
              style={
                {
                  "--glow": rejected ? "var(--reject)" : "var(--acid)",
                  "--aura-x": "88%",
                  "--aura-y": "20%",
                  "--aura-strength": 0.3,
                } as React.CSSProperties
              }
            >
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-text">
                  {e.conceptLabel}{" "}
                  <span className="font-mono text-2xs font-normal text-faint">via {e.domainName}</span>
                </span>
                <span
                  className={`slabel shrink-0 ${rejected ? "text-reject" : "text-acid-text"}`}
                >
                  {e.isFallback ? "plain" : e.status} · a{e.attempt}
                </span>
              </div>
              {e.preview && <p className="text-sm leading-relaxed text-dim">{e.preview}</p>}
              {rejected &&
                e.verdict.contradictions.map((c, i) => (
                  <p key={i} className="mt-2 text-xs leading-relaxed text-reject-text">
                    <span className="font-medium text-reject">{c.claim}</span> — {c.reason}
                  </p>
                ))}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
