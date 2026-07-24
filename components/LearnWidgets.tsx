"use client";

import { useMemo, useState } from "react";
import type { Widget } from "@/lib/learn/widgets";
import { evalExpression } from "@/lib/learn/evalFormula";
import { useT } from "./LanguageProvider";

/** Render the agent-chosen interactive/visual widgets for a concept. */
export function LearnWidgets({ widgets }: { widgets: Widget[] }) {
  if (!widgets?.length) return null;
  return (
    <div className="mt-6 space-y-5">
      {widgets.map((w, i) => (
        <WidgetCard key={i} w={w} />
      ))}
    </div>
  );
}

function WidgetCard({ w }: { w: Widget }) {
  const t = useT();
  const interactive = w.type === "formula" || w.type === "steps";
  return (
    <div
      className="aura card p-5"
      style={
        {
          "--glow": "var(--interest)",
          "--aura-x": "12%",
          "--aura-y": "18%",
          "--aura-strength": 0.32,
        } as React.CSSProperties
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="slabel" style={{ color: "#ffa6d8" }}>
          {w.title}
        </p>
        {/* Interactive widgets read as decoration unless they say they react to
            touch — the formula sliders in particular went unused. */}
        {interactive && <span className="slabel shrink-0 text-faint">{t("widget.tryIt")}</span>}
      </div>
      {w.caption && <p className="mt-1.5 text-xs leading-relaxed text-faint">{w.caption}</p>}
      <div className="mt-4">
        {w.type === "scale" && <ScaleWidget w={w} />}
        {w.type === "steps" && <StepsWidget w={w} />}
        {w.type === "barChart" && <BarChartWidget w={w} />}
        {w.type === "diagram" && <DiagramWidget w={w} />}
        {w.type === "formula" && <FormulaWidget w={w} />}
      </div>
    </div>
  );
}

function pct(v: number, min: number, max: number) {
  if (max === min) return 0;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

const ZONE_COLORS = ["#3b7bff", "#8b5cff", "#ff3bac", "#ffb877", "#c9ff7a"];

function ScaleWidget({ w }: { w: Extract<Widget, { type: "scale" }> }) {
  return (
    <div className="pb-8 pt-2">
      <div className="relative h-2.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        {/* zones */}
        {w.zones?.map((z, i) => {
          const left = pct(Math.min(z.from, z.to), w.min, w.max);
          const right = pct(Math.max(z.from, z.to), w.min, w.max);
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${left}%`,
                width: `${right - left}%`,
                background: `${ZONE_COLORS[i % ZONE_COLORS.length]}44`,
                borderRadius: 999,
              }}
              title={z.label}
            />
          );
        })}
        {/* markers */}
        {w.markers.map((m, i) => {
          const p = pct(m.value, w.min, w.max);
          return (
            <div key={i} className="absolute top-1/2" style={{ left: `${p}%`, transform: "translate(-50%,-50%)" }}>
              <div
                className="h-4 w-4 rounded-full"
                style={{ background: "var(--interest)", boxShadow: "0 0 12px var(--interest)" }}
              />
              <div
                className="absolute start-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap text-2xs font-medium text-dim"
                style={{ top: "100%" }}
              >
                {m.label}
                <span className="ms-1 font-mono text-faint">
                  {m.value}
                  {w.unit ?? ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-2xs text-faint">
        <span>
          {w.min}
          {w.unit ?? ""}
        </span>
        <span>
          {w.max}
          {w.unit ?? ""}
        </span>
      </div>
      {/* zone legend */}
      {w.zones && w.zones.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1">
          {w.zones.map((z, i) => (
            <span key={i} className="flex items-center gap-1.5 text-2xs text-faint">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
              />
              {z.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepsWidget({ w }: { w: Extract<Widget, { type: "steps" }> }) {
  const t = useT();
  const [shown, setShown] = useState(1);
  const done = shown >= w.steps.length;
  return (
    <div>
      <ol className="space-y-3">
        {w.steps.slice(0, shown).map((s, i) => (
          <li key={i} className="reveal flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-2xs font-semibold"
              style={{
                background: i === shown - 1 ? "var(--interest)" : "rgba(255,255,255,0.08)",
                color: i === shown - 1 ? "#0b0b12" : "var(--dim)",
                boxShadow: i === shown - 1 ? "0 0 12px var(--interest)" : "none",
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">{s.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-dim">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        onClick={() => setShown((n) => (done ? 1 : Math.min(w.steps.length, n + 1)))}
        className="slabel mt-4 text-interest-text transition hover:opacity-80"
      >
        {done ? `↺ ${t("widget.replay")}` : `${t("widget.nextStep")} →`}
        <span className="ms-2 font-mono text-faint">
          {shown}/{w.steps.length}
        </span>
      </button>
    </div>
  );
}

function BarChartWidget({ w }: { w: Extract<Widget, { type: "barChart" }> }) {
  const max = Math.max(...w.bars.map((b) => Math.abs(b.value)), 1);
  return (
    <div className="space-y-2.5">
      {w.bars.map((b, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs font-medium text-dim">{b.label}</span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(Math.abs(b.value) / max) * 100}%`,
                background: ZONE_COLORS[i % ZONE_COLORS.length],
                boxShadow: `0 0 10px ${ZONE_COLORS[i % ZONE_COLORS.length]}88`,
              }}
            />
          </div>
          <span className="w-14 shrink-0 text-end font-mono text-2xs text-faint">
            {b.value}
            {w.unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function DiagramWidget({ w }: { w: Extract<Widget, { type: "diagram" }> }) {
  return (
    <div>
      <div className="mb-3 flex justify-center">
        <span
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-text"
          style={{ background: "rgba(255,59,172,0.16)", boxShadow: "0 0 20px rgba(255,59,172,0.3)" }}
        >
          {w.center}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {w.parts.map((p, i) => (
          <div
            key={i}
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs font-semibold text-text">{p.label}</p>
            {p.note && <p className="mt-0.5 text-2xs leading-relaxed text-faint">{p.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormulaWidget({ w }: { w: Extract<Widget, { type: "formula" }> }) {
  const [vals, setVals] = useState<Record<string, number>>(
    () => Object.fromEntries(w.variables.map((v) => [v.symbol, v.default])),
  );
  const result = useMemo(() => evalExpression(w.expression, vals), [vals, w.expression]);
  const decimals = w.result.decimals ?? 2;

  return (
    <div>
      <div className="space-y-4">
        {w.variables.map((v) => {
          const step = v.step ?? ((v.max - v.min) / 100 || 1);
          return (
            <div key={v.symbol}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-medium text-dim">
                  {v.label} <span className="font-mono text-faint">({v.symbol})</span>
                </span>
                <span className="font-mono text-xs text-interest-text">
                  {vals[v.symbol]}
                  {v.unit ? ` ${v.unit}` : ""}
                </span>
              </div>
              <input
                type="range"
                min={v.min}
                max={v.max}
                step={step}
                value={vals[v.symbol]}
                onChange={(e) => setVals((s) => ({ ...s, [v.symbol]: Number(e.target.value) }))}
                className="w-full accent-[var(--interest)]"
              />
            </div>
          );
        })}
      </div>
      <div
        className="mt-5 flex items-baseline justify-between rounded-xl px-4 py-3"
        style={{ background: "rgba(255,59,172,0.1)", boxShadow: "inset 0 0 0 1px rgba(255,59,172,0.2)" }}
      >
        <span className="slabel text-dim">{w.result.label}</span>
        <span className="font-mono text-lg font-semibold" style={{ color: "#ffa6d8" }}>
          {result === null ? "—" : result.toFixed(decimals)}
          {w.result.unit ? <span className="ms-1 text-xs text-faint">{w.result.unit}</span> : null}
        </span>
      </div>
    </div>
  );
}
