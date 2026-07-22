"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { Led } from "@/components/Led";
import { TickScale } from "@/components/TickScale";
import { useT } from "@/components/LanguageProvider";

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
  summary: { headline: string; prose: string; lines: string[] };
};

export default function Brain() {
  const t = useT();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/brain")
      .then((r) => {
        if (r.status === 401) window.location.href = "/signin";
        return r.json();
      })
      .then(setData);
  }, []);

  return (
    <Shell>
      <PageHead eyebrow={t("brain.eyebrow")} title={t("brain.title")} sub={t("brain.sub")} />

      {!data && <p className="mt-10 text-center text-sm text-faint">{t("common.loading")}</p>}

      {data && (
        <>
          {/* the human read: what you're into, in plain words */}
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
              {t("brain.whatThinks")}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-text">
              {data.summary.headline}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-dim">{data.summary.prose}</p>

            {/* interest split, in percent */}
            {data.branches.length > 0 && (() => {
              const totalW = data.branches.reduce((s, b) => s + b.totalWeight, 0) || 1;
              return (
                <div className="mt-6 space-y-3">
                  {data.branches.slice(0, 5).map((b, i) => {
                    const pct = Math.round((b.totalWeight / totalW) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 truncate text-sm font-medium text-text">
                          {b.label}
                        </span>
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: i === 0 ? "var(--interest)" : "var(--violet)",
                              boxShadow: `0 0 10px ${i === 0 ? "rgba(255,59,172,0.5)" : "rgba(139,92,255,0.4)"}`,
                            }}
                          />
                        </div>
                        <span className="flex w-14 shrink-0 justify-end">
                          <Led value={`${pct}`} dot={2.6} color={i === 0 ? "#ffa6d8" : "#c9b3ff"} suffix="%" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* the numbers — secondary, for the curious */}
          <div className="mb-2 mt-10 flex items-center gap-3">
            <span className="h-px flex-1 bg-hair" />
            <span className="slabel text-faint">{t("brain.numbers")}</span>
            <span className="h-px flex-1 bg-hair" />
          </div>
          <ul className="mb-5 space-y-2 px-1">
            {data.summary.lines.map((l, i) => (
              <li key={i} className="text-xs leading-relaxed text-faint">
                {l}
              </li>
            ))}
          </ul>

          {/* stats strip */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: t("brain.signals"), value: data.stats.signals, color: "#c9b3ff" },
              { label: t("brain.branches"), value: data.stats.branches, color: "#9dc0ff" },
              { label: t("brain.skills"), value: data.stats.skills, color: "#c9ff7a" },
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
              <p className="text-sm text-dim">{t("brain.noSignals")}</p>
              <Link href="/onboarding" className="btn btn-primary mt-6">
                {t("brain.buildProfile")}
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
                          <span className="slabel text-faint">{t("brain.wt")}</span>
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <TickScale value={b.confidence} color="var(--violet)" count={30} className="max-w-[150px]" />
                        <span className="slabel text-faint">
                          {t("brain.coherence", { p: Math.round(b.confidence * 100) })}
                          {b.successRate !== null &&
                            t("brain.clicked", { p: Math.round(b.successRate * 100) })}
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
                          <p className="slabel mb-2.5 text-curriculum-text">{t("brain.skillsVia")}</p>
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
