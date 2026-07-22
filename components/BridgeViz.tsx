"use client";

import { Led } from "./Led";
import { TickScale } from "./TickScale";

/**
 * The signature visualization: concept node (curriculum blue) and interest node
 * (magenta), connected by a drawn glowing line; the similarity as a dot-matrix
 * readout over a tick scale; the structural correspondences as hairline rows.
 * The freeze-frame of the demo.
 */
type Correspondence = { subject: string; yourWorld: string; explanation: string };

export function BridgeViz({
  conceptLabel,
  domainName,
  similarity,
  correspondences,
  animate = true,
}: {
  conceptLabel: string;
  domainName: string;
  similarity: number;
  correspondences: Correspondence[];
  animate?: boolean;
}) {
  return (
    <div className="card relative overflow-hidden p-5">
      {/* dual aura wash */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(52% 70% at 10% 15%, rgba(59,123,255,0.26), transparent 60%), radial-gradient(52% 70% at 90% 15%, rgba(255,59,172,0.26), transparent 60%)",
        }}
      />

      {/* nodes + drawn bridge */}
      <div className="relative flex items-center justify-between gap-10">
        <svg
          className="pointer-events-none absolute inset-x-2 top-1/2 h-10 w-[calc(100%-16px)] -translate-y-1/2"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="bridgeline" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b7bff" />
              <stop offset="100%" stopColor="#ff3bac" />
            </linearGradient>
          </defs>
          <path
            d="M8 12 Q50 -2 92 12"
            fill="none"
            stroke="url(#bridgeline)"
            strokeWidth="1.25"
            strokeLinecap="round"
            className={animate ? "bridge-draw" : ""}
            style={{ filter: "drop-shadow(0 0 4px rgba(139,92,255,0.7))" }}
          />
        </svg>
        <span className="node node-blue z-10 w-[42%] truncate text-center">{conceptLabel}</span>
        <span className="node node-magenta z-10 w-[42%] truncate text-center">{domainName}</span>
      </div>

      {/* similarity readout */}
      <div className="mt-5 flex flex-col items-center">
        <Led value={similarity.toFixed(2)} dot={4} color="#c9d6ff" />
        <TickScale value={similarity} color="#8b5cff" count={40} className="mt-2.5 max-w-[220px]" />
        <span className="slabel mt-2 text-faint">semantic overlap · cosine</span>
      </div>

      {/* correspondence rows */}
      <div className="mt-5 overflow-hidden bg-white/[0.03]" style={{ borderRadius: "var(--r)" }}>
        {correspondences.map((c, i) => (
          <div key={i} className={`px-4 py-3 ${i > 0 ? "border-t border-hair" : ""}`}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
              <span className="truncate text-sm font-medium text-curriculum-text">{c.subject}</span>
              <span className="font-mono text-2xs text-faint">↔</span>
              <span className="truncate text-right text-sm font-medium text-interest-text">
                {c.yourWorld}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-dim">{c.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
