"use client";

import { Led } from "./Led";
import { TickScale } from "./TickScale";

/**
 * The signature visualization: the concept node (curriculum blue) and the
 * interest-domain node (magenta) connected by a drawn, glowing line, with the
 * structural correspondences as hairline-separated rows — subject term <->
 * your term. Rendered as a luminous instrument. The freeze-frame of the demo.
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
    <div className="glass lit relative overflow-hidden rounded-[--r-lg] p-5">
      {/* dual aura wash */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 70% at 12% 20%, rgba(59,123,255,0.28), transparent 60%), radial-gradient(50% 70% at 88% 20%, rgba(255,59,172,0.28), transparent 60%)",
        }}
      />

      {/* two nodes + drawn bridge */}
      <div className="relative mb-1 flex items-center justify-between gap-2">
        <span className="z-10 max-w-[42%] truncate rounded-full bg-[rgba(59,123,255,0.16)] px-3 py-1.5 text-sm font-medium text-[#9dc0ff] shadow-[0_0_20px_rgba(59,123,255,0.35)]">
          {conceptLabel}
        </span>
        <svg className="absolute inset-x-0 top-1/2 -z-0 h-10 w-full -translate-y-1/2" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="bridgeline" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b7bff" />
              <stop offset="100%" stopColor="#ff3bac" />
            </linearGradient>
          </defs>
          <path
            d="M6 12 Q50 -2 94 12"
            fill="none"
            stroke="url(#bridgeline)"
            strokeWidth="1.25"
            strokeLinecap="round"
            className={animate ? "bridge-draw" : ""}
            style={{ filter: "drop-shadow(0 0 4px rgba(140,90,255,0.7))" }}
          />
        </svg>
        <span className="z-10 max-w-[42%] truncate rounded-full bg-[rgba(255,59,172,0.16)] px-3 py-1.5 text-right text-sm font-medium text-[#ffa6d8] shadow-[0_0_20px_rgba(255,59,172,0.35)]">
          {domainName}
        </span>
      </div>

      {/* similarity readout */}
      <div className="mb-4 mt-3 flex flex-col items-center gap-2">
        <div className="flex items-baseline gap-2">
          <Led value={similarity.toFixed(2)} dot={4} color="#c9d6ff" />
        </div>
        <TickScale value={similarity} color="#8b5cff" count={40} className="max-w-[220px]" />
        <span className="font-mono text-2xs uppercase tracking-[0.2em] text-faint">
          semantic overlap · cosine · bridged by the engine
        </span>
      </div>

      {/* correspondence rows */}
      <div className="rounded-[--r] bg-[rgba(255,255,255,0.03)]">
        {correspondences.map((c, i) => (
          <div key={i} className={i > 0 ? "border-t border-hair" : ""}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-2.5">
              <span className="text-sm font-medium text-[#9dc0ff]">{c.subject}</span>
              <span className="font-mono text-2xs text-faint">↔</span>
              <span className="text-right text-sm font-medium text-[#ffa6d8]">{c.yourWorld}</span>
            </div>
            <p className="px-3 pb-2.5 pt-1 text-xs leading-relaxed text-dim">{c.explanation}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .bridge-draw {
          stroke-dasharray: 140;
          stroke-dashoffset: 140;
          animation: draw 1s ease forwards;
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bridge-draw {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
