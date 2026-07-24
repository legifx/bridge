"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "./LanguageProvider";

type Skill = { id: string; label: string; mastery: number };
type Branch = {
  label: string;
  totalWeight: number;
  confidence: number;
  successRate: number | null;
  skills: Skill[];
};

/**
 * An interactive memory map — the first thing on the Brain tab. A glowing core
 * (you) with your interests around it, each sized by how much Bridge knows about
 * it. Tap an interest to see what you've learned through it. Plain-language, no
 * jargon — the numbers live below, for the curious.
 */
const W = 400;
const H = 340;
const CX = W / 2;
const CY = 168;
const CORE_R = 26;
const RING_R = 118;

function masteryColor(m: number) {
  if (m >= 0.66) return "#c9ff7a";
  if (m >= 0.4) return "#9dc0ff";
  return "#ffb877";
}

export function BrainGraph({ branches }: { branches: Branch[] }) {
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);

  const shown = branches.slice(0, 8);
  if (shown.length === 0) return null;
  const maxW = Math.max(...shown.map((b) => b.totalWeight), 1);

  const nodeOf = (i: number) => {
    const angle = (-90 + (360 / shown.length) * i) * (Math.PI / 180);
    return { x: CX + RING_R * Math.cos(angle), y: CY + RING_R * Math.sin(angle), angle };
  };
  const radiusOf = (w: number) => 16 + 20 * Math.sqrt(Math.min(1, w / maxW));

  const sel = selected !== null ? shown[selected] : null;

  return (
    <div className="card overflow-hidden p-4">
      <svg viewBox={`0 -22 ${W} ${H + 44}`} className="w-full" style={{ maxHeight: 400 }} role="img">
        <defs>
          <radialGradient id="bgCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(179,140,255,0.9)" />
            <stop offset="100%" stopColor="rgba(139,92,255,0.15)" />
          </radialGradient>
        </defs>

        {/* links */}
        {shown.map((b, i) => {
          const n = nodeOf(i);
          const dim = selected !== null && selected !== i;
          return (
            <line
              key={`l${i}`}
              x1={CX}
              y1={CY}
              x2={n.x}
              y2={n.y}
              stroke={i === 0 ? "rgba(255,59,172,0.5)" : "rgba(139,92,255,0.45)"}
              strokeWidth={1 + 2.5 * (b.totalWeight / maxW)}
              opacity={dim ? 0.12 : 0.7}
            />
          );
        })}

        {/* selected interest's skills as leaf nodes */}
        {sel &&
          sel.skills.slice(0, 6).map((s, j, arr) => {
            const n = nodeOf(selected!);
            const spread = Math.min(Math.PI, arr.length * 0.5);
            const a = n.angle - spread / 2 + (arr.length > 1 ? (spread / (arr.length - 1)) * j : 0);
            const lx = n.x + 52 * Math.cos(a);
            const ly = n.y + 52 * Math.sin(a);
            return (
              <g key={`s${j}`} className="reveal">
                <line x1={n.x} y1={n.y} x2={lx} y2={ly} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <circle cx={lx} cy={ly} r={6} fill={masteryColor(s.mastery)} opacity={0.9} />
              </g>
            );
          })}

        {/* core */}
        <circle cx={CX} cy={CY} r={CORE_R + 8} fill="url(#bgCore)" opacity={0.5} />
        <circle cx={CX} cy={CY} r={CORE_R} fill="rgba(20,18,30,0.9)" stroke="rgba(179,140,255,0.7)" strokeWidth={1.5} />
        <text x={CX} y={CY + 4} textAnchor="middle" className="fill-text" style={{ fontSize: 12, fontWeight: 600 }}>
          {t("brain.you")}
        </text>

        {/* interest nodes */}
        {shown.map((b, i) => {
          const n = nodeOf(i);
          const r = radiusOf(b.totalWeight);
          const active = selected === i;
          const dim = selected !== null && !active;
          const color = i === 0 ? "255,59,172" : "139,92,255";
          return (
            <g
              key={`n${i}`}
              onClick={() => setSelected(active ? null : i)}
              style={{ cursor: "pointer" }}
              opacity={dim ? 0.35 : 1}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={`rgba(${color},0.18)`}
                stroke={`rgba(${color},${active ? 0.95 : 0.6})`}
                strokeWidth={active ? 2.5 : 1.5}
                style={{ filter: active ? `drop-shadow(0 0 12px rgba(${color},0.6))` : "none" }}
              />
              <text
                x={n.x}
                y={n.y + r + 13}
                textAnchor="middle"
                className="fill-dim"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                {b.label.length > 16 ? b.label.slice(0, 15) + "…" : b.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* plain-language read of the tapped interest, or a hint */}
      {sel ? (
        <div className="reveal mt-1 px-1 pb-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight text-text">{sel.label}</h3>
            <span className="slabel text-faint">
              {t("brain.coherence", { p: Math.round(sel.confidence * 100) })}
              {sel.successRate !== null && t("brain.clicked", { p: Math.round(sel.successRate * 100) })}
            </span>
          </div>
          {sel.skills.length > 0 ? (
            <>
              <p className="mt-2 text-xs text-faint">{t("brain.graphSkills")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sel.skills.map((s) => (
                  <Link
                    key={s.id}
                    href={`/learn/${s.id}`}
                    className="chip"
                    style={{
                      background: `${masteryColor(s.mastery)}22`,
                      color: masteryColor(s.mastery),
                      boxShadow: `inset 0 0 0 1px ${masteryColor(s.mastery)}44`,
                    }}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-faint">{t("brain.graphNoSkills")}</p>
          )}
        </div>
      ) : (
        <p className="mt-1 px-1 pb-1 text-center text-xs text-faint">{t("brain.graphHint")}</p>
      )}
    </div>
  );
}
