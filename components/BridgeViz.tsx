"use client";

import { Led } from "./Led";
import { TickScale } from "./TickScale";
import { useT } from "./LanguageProvider";

/**
 * The signature visualization: concept node (curriculum blue) and interest node
 * (magenta) joined by a drawn, glowing arc; the similarity as a dot-matrix
 * readout over a tick scale; the structural correspondences as hairline rows.
 * The arc lives in its own flex slot BETWEEN the pills — it never crosses text.
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
  const t = useT();
  return (
    <div className="card relative overflow-hidden p-6">
      {/* dual aura wash */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(52% 70% at 10% 12%, rgba(59,123,255,0.24), transparent 60%), radial-gradient(52% 70% at 90% 12%, rgba(255,59,172,0.24), transparent 60%)",
        }}
      />

      {/* nodes joined by the drawn bridge — the arc has its own slot */}
      <div className="flex items-center gap-2.5">
        <span className="node node-blue min-w-0 max-w-[42%] flex-shrink truncate text-center">
          {conceptLabel}
        </span>
        <svg
          className="h-9 min-w-[44px] flex-1"
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
            d="M3 19 Q50 1 97 19"
            fill="none"
            stroke="url(#bridgeline)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={animate ? "bridge-draw" : ""}
            style={{ filter: "drop-shadow(0 0 4px rgba(139,92,255,0.7))" }}
          />
          <circle cx="3" cy="19" r="2.2" fill="#3b7bff" style={{ filter: "drop-shadow(0 0 3px #3b7bff)" }} />
          <circle cx="97" cy="19" r="2.2" fill="#ff3bac" style={{ filter: "drop-shadow(0 0 3px #ff3bac)" }} />
        </svg>
        <span className="node node-magenta min-w-0 max-w-[42%] flex-shrink truncate text-center">
          {domainName}
        </span>
      </div>

      {/* similarity readout */}
      <div className="mt-8 flex flex-col items-center">
        <Led value={similarity.toFixed(2)} dot={4} color="#c9d6ff" />
        <TickScale value={similarity} color="#8b5cff" count={40} className="mt-3.5 max-w-[220px]" />
        <span className="slabel mt-3 text-faint">{t("viz.overlap")}</span>
      </div>

      {/* correspondence rows */}
      <div className="mt-8 overflow-hidden bg-white/[0.03]" style={{ borderRadius: "var(--r)" }}>
        {correspondences.map((c, i) => (
          <div
            key={i}
            className={`reveal px-5 py-4 ${i > 0 ? "border-t border-hair" : ""}`}
            style={{ animationDelay: `${200 + i * 110}ms` }}
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-4">
              <span className="truncate text-sm font-medium text-curriculum-text">{c.subject}</span>
              <span className="font-mono text-2xs text-faint">↔</span>
              <span className="truncate text-end text-sm font-medium text-interest-text">
                {c.yourWorld}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-dim">{c.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
