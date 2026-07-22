"use client";

import { useEffect, useMemo, useState } from "react";

export type ThinkingStage = {
  /** what the algorithm is doing right now, e.g. "Embedding your interests" */
  label: string;
  /** optional second line with the concrete mechanics, e.g. "384-dim vectors, local model" */
  detail?: string;
};

/**
 * A progress-aware "the algorithm is thinking" animation — instead of a dead
 * spinner, it narrates the real pipeline stage by stage while a small
 * instrument (orbiting signals around a pulsing core) keeps the screen alive.
 *
 * Stages auto-advance on a timer sized to `expectedMs` and hold on the last
 * stage until the caller unmounts the loader — so it never claims "done"
 * before the server actually is.
 */
export function ThinkingLoader({
  stages,
  items = [],
  glow = "var(--interest)",
  expectedMs = 6000,
}: {
  stages: ThinkingStage[];
  /** real data flowing through the pipeline (seeds, answers…) — shown as drifting chips */
  items?: string[];
  glow?: string;
  expectedMs?: number;
}) {
  const [stage, setStage] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);

  const perStage = Math.max(900, expectedMs / Math.max(1, stages.length));

  useEffect(() => {
    setStage(0);
    const t = setInterval(
      () => setStage((s) => Math.min(s + 1, stages.length - 1)),
      perStage,
    );
    return () => clearInterval(t);
  }, [stages, perStage]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setItemIdx((i) => (i + 1) % items.length), 1300);
    return () => clearInterval(t);
  }, [items]);

  const orbitDots = useMemo(
    () => [
      { dur: "2.6s", delay: "0s", size: 5, color: "var(--curriculum)" },
      { dur: "3.4s", delay: "-1.2s", size: 4, color: "var(--interest)" },
      { dur: "4.4s", delay: "-2.1s", size: 3, color: "var(--violet)" },
    ],
    [],
  );

  return (
    <div
      className="aura card p-7 text-center"
      style={
        {
          "--glow": glow,
          "--aura-y": "30%",
          "--aura-strength": 0.5,
        } as React.CSSProperties
      }
      role="status"
      aria-live="polite"
    >
      {/* the instrument: pulsing core + orbiting signals */}
      <div className="relative mx-auto mb-6 h-24 w-24">
        <span className="think-ring" style={{ animationDelay: "0s" }} />
        <span className="think-ring" style={{ animationDelay: "0.9s" }} />
        <span
          className="think-core"
          style={{ background: `radial-gradient(circle at 40% 35%, #fff, ${"var(--curriculum)"} 55%, transparent 75%)` }}
        />
        {orbitDots.map((d, i) => (
          <span
            key={i}
            className="think-orbit"
            style={{ animationDuration: d.dur, animationDelay: d.delay }}
          >
            <span
              style={{
                width: d.size,
                height: d.size,
                borderRadius: 999,
                background: d.color,
                boxShadow: `0 0 10px ${d.color}`,
                display: "block",
              }}
            />
          </span>
        ))}
      </div>

      {/* the data actually flowing through the pipeline */}
      {items.length > 0 && (
        <p className="mb-4 h-6">
          <span key={itemIdx} className="chip chip-interest pop max-w-full">
            <span className="truncate">{items[itemIdx]}</span>
          </span>
        </p>
      )}

      {/* stage narration — done stages dim, the current one shimmers */}
      <ol className="mx-auto inline-block space-y-2 text-left">
        {stages.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500"
              style={{
                background:
                  i < stage ? "var(--acid)" : i === stage ? "var(--curriculum)" : "rgba(255,255,255,0.15)",
                boxShadow:
                  i < stage
                    ? "0 0 8px var(--acid)"
                    : i === stage
                      ? "0 0 10px var(--curriculum)"
                      : undefined,
              }}
            />
            <span className={i < stage ? "text-faint line-through decoration-white/20" : i === stage ? "think-shimmer font-medium" : "text-faint"}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {stages[stage]?.detail && (
        <p className="mt-3 text-xs leading-relaxed text-dim">{stages[stage].detail}</p>
      )}
    </div>
  );
}
