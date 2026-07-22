"use client";

import { useAnimatedNumber } from "./useAnimatedNumber";

/**
 * A thin tick-mark gauge: 1px hairline ticks with a glowing pointer at `value`
 * (0..1). The pointer sweeps to its position on mount and ticks light up as it
 * passes — brightness and height fall off smoothly around it, like an analog
 * instrument needle field.
 */
export function TickScale({
  value = 0.5,
  color = "var(--curriculum)",
  count = 44,
  className = "",
}: {
  value?: number;
  color?: string;
  count?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, useAnimatedNumber(Math.max(0, Math.min(1, value)))));
  const active = Math.round(v * (count - 1));
  return (
    <div className={`relative w-full ${className}`} style={{ height: 22 }} aria-hidden>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between" style={{ height: 16 }}>
        {Array.from({ length: count }).map((_, i) => {
          const dist = Math.abs(i - active);
          const lit = dist <= 2;
          const tall = i % 6 === 0;
          return (
            <span
              key={i}
              style={{
                width: 1,
                height: lit ? 16 - dist * 3 : tall ? 11 : 7,
                background: lit ? color : `rgba(255,255,255,${tall ? 0.26 : 0.16})`,
                opacity: lit ? 1 - dist * 0.22 : 1,
                boxShadow: dist === 0 ? `0 0 7px ${color}` : undefined,
              }}
            />
          );
        })}
      </div>
      <span
        className="absolute top-0"
        style={{
          left: `${v * 100}%`,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: `5px solid ${color}`,
          filter: `drop-shadow(0 0 5px ${color})`,
        }}
      />
    </div>
  );
}
