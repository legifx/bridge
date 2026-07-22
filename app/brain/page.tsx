"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { Led } from "@/components/Led";
import { TickScale } from "@/components/TickScale";

type Branch = {
  label: string;
  totalWeight: number;
  confidence: number;
  successRate: number | null;
  items: { label: string; kind: string; weight: number }[];
  skills: { id: string; label: string; mastery: number }[];
};
type Data = {
  branches: Branch[];
  stats: { signals: number; totalWeight: number; branches: number; skills: number };
  summary: { headline: string; lines: string[] };
};

export default function Brain() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/brain")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <Shell>
      <PageHead
        eyebrow="Second brain"
        title="What Bridge thinks you're into"
        sub="A per-learner vector store that grows with every signal. Clusters, weights and posteriors are shown as they are — nothing is guessed."
      />

      {!data && <p className="mt-10 text-center text-sm text-faint">Loading…</p>}

      {data && (
        <>
          {/* the algorithm's honest read */}
          <div
            className="aura card -mt-2 p-6"
            style={
              {
                "--glow": "var(--violet)",
                "--aura-x": "18%",
                "--aura-y": "20%",
                "--aura-strength": 0.5,
              } as React.CSSProperties
            }
          >
            <p className="slabel" style={{ color: "#c9b3ff" }}>
              algorithm&rsquo;s read
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-text">
              {data.summary.headline}
            </h2>
            <ul className="mt-3 space-y-2">
              {data.summary.lines.map((l, i) => (
                <li key={i} className="text-sm leading-relaxed text-dim">
                  {l}
                </li>
              ))}
            </ul>
          </div>

          {/* stats strip */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "signals", value: data.stats.signals, color: "#c9b3ff" },
              { label: "branches", value: data.stats.branches, color: "#9dc0ff" },
              { label: "skills", value: data.stats.skills, color: "#c9ff7a" },
            ].map((s) => (
              <div key={s.label} className="card flex flex-col items-center gap-1.5 p-4">
                <Led value={`${s.value}`} dot={3.4} color={s.color} />
                <span className="slabel text-faint">{s.label}</span>
              </div>
            ))}
          </div>

          {/* the tree: a spine with branches */}
          {data.branches.length === 0 ? (
            <div className="card mt-6 p-8 text-center">
              <p className="text-sm text-dim">
                No signals yet. Build a profile and learn something — the tree grows on its own.
              </p>
              <Link href="/onboarding" className="btn btn-primary mt-6">
                Build my profile
              </Link>
            </div>
          ) : (
            <div className="relative mt-8 pl-9">
              {/* spine */}
              <span className="absolute bottom-6 left-3 top-0 w-px bg-hair" aria-hidden />
              {/* root */}
              <div className="absolute -top-1 left-3 -translate-x-1/2" aria-hidden>
                <span
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{ background: "var(--violet)", boxShadow: "0 0 12px var(--violet)" }}
                />
              </div>

              <div className="space-y-6">
                {data.branches.map((b, i) => (
                  <div key={i} className="reveal relative" style={{ animationDelay: `${i * 90}ms` }}>
                    {/* branch elbow */}
                    <svg
                      className="absolute -left-6 top-7 h-6 w-6"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        d="M1 0 Q1 12 12 12 L24 12"
                        fill="none"
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="1"
                      />
                    </svg>

                    <div
                      className="aura card p-5"
                      style={
                        {
                          "--glow": "var(--interest)",
                          "--aura-x": "10%",
                          "--aura-y": "25%",
                          "--aura-strength": Math.min(0.55, 0.2 + b.totalWeight * 0.06),
                        } as React.CSSProperties
                      }
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="min-w-0 truncate text-base font-semibold tracking-tight text-text">
                          {b.label}
                        </h3>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <Led value={b.totalWeight.toFixed(1)} dot={2.8} color="#ffa6d8" />
                          <span className="slabel text-faint">wt</span>
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <TickScale value={b.confidence} color="var(--violet)" count={30} className="max-w-[150px]" />
                        <span className="slabel text-faint">
                          coherence {Math.round(b.confidence * 100)}%
                          {b.successRate !== null && ` · ${Math.round(b.successRate * 100)}% clicked`}
                        </span>
                      </div>

                      {/* interest leaves */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {b.items.map((it, j) => (
                          <span
                            key={j}
                            className="chip chip-interest"
                            style={{ opacity: 0.55 + Math.min(0.45, it.weight * 0.25) }}
                          >
                            {it.label}
                          </span>
                        ))}
                      </div>

                      {/* skills learned through this branch */}
                      {b.skills.length > 0 && (
                        <div className="mt-4 border-t border-hair pt-4">
                          <p className="slabel mb-2.5 text-curriculum-text">skills via this interest</p>
                          <div className="flex flex-wrap gap-2">
                            {b.skills.map((s) => (
                              <Link
                                key={s.id}
                                href={`/learn/${s.id}`}
                                className={`chip ${s.mastery >= 0.6 ? "" : "chip-curriculum"}`}
                                style={
                                  s.mastery >= 0.6
                                    ? {
                                        background: "rgba(179,255,60,0.12)",
                                        color: "var(--acid-text)",
                                        boxShadow: "0 0 16px rgba(179,255,60,0.2)",
                                      }
                                    : undefined
                                }
                              >
                                {s.label}
                                <Led
                                  value={`${Math.round(s.mastery * 100)}`}
                                  dot={2.2}
                                  color={s.mastery >= 0.6 ? "#c9ff7a" : "#9dc0ff"}
                                  suffix="%"
                                />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
