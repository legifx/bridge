"use client";

import { useAnimatedNumber } from "./useAnimatedNumber";

/**
 * Dot-matrix LED numerals — the signature readout of the instrument aesthetic.
 * Each glyph is a 5x7 dot grid: lit dots glow (one drop-shadow per glyph, cheap)
 * over a faint dot field. Pure SVG, no font dependency, scales with `dot`.
 * Plain numeric values count up from zero on mount, padded with unlit cells so
 * the width never jumps. `suffix` renders a small mono unit ("%", "d").
 */
const FONT: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "00100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  "%": ["11001", "11010", "00100", "00100", "01011", "10011", "00000"],
  "°": ["01100", "10010", "10010", "01100", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

export function Led({
  value,
  dot = 4,
  color = "currentColor",
  suffix,
  className = "",
}: {
  value: string | number;
  dot?: number;
  color?: string;
  suffix?: string;
  className?: string;
}) {
  const target = String(value);
  const numeric = /^\d+(\.\d+)?$/.test(target);
  const decimals = (target.split(".")[1] ?? "").length;
  const animated = useAnimatedNumber(numeric ? parseFloat(target) : NaN);
  // Pad with spaces (unlit cells) to the final length so width stays stable.
  const display = numeric
    ? animated.toFixed(decimals).padStart(target.length, " ")
    : target;
  const chars = display.split("");
  const step = dot * 1.55;
  const r = dot / 2;
  const cellW = 5 * step;
  const cellH = 7 * step;
  const gap = step * 0.9;

  return (
    <span className={`inline-flex items-end ${className}`} style={{ gap, color, lineHeight: 0 }}>
      {chars.map((ch, i) => {
        const grid = FONT[ch] ?? FONT[" "];
        const off: React.ReactNode[] = [];
        const on: React.ReactNode[] = [];
        grid.forEach((row, y) =>
          row.split("").forEach((bit, x) => {
            const cx = x * step + step / 2;
            const cy = y * step + step / 2;
            (bit === "1" ? on : off).push(
              <circle key={`${x}-${y}`} cx={cx} cy={cy} r={r} />,
            );
          }),
        );
        return (
          <svg
            key={i}
            width={cellW}
            height={cellH}
            viewBox={`0 0 ${cellW} ${cellH}`}
            aria-hidden
            style={{ display: "block", overflow: "visible" }}
          >
            <g fill="rgba(255,255,255,0.06)">{off}</g>
            <g fill={color} style={{ filter: `drop-shadow(0 0 ${dot * 1.1}px ${color})` }}>
              {on}
            </g>
          </svg>
        );
      })}
      {suffix && (
        <span
          className="font-mono"
          style={{ fontSize: "0.6875rem", lineHeight: 1, color: "var(--faint)", paddingBottom: 1 }}
        >
          {suffix}
        </span>
      )}
      <span className="sr-only">
        {target}
        {suffix ?? ""}
      </span>
    </span>
  );
}
