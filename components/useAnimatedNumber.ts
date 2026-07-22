"use client";

import { useEffect, useState } from "react";

/**
 * Animate a number from 0 to `target` with an ease-out curve. Returns the
 * current in-flight value. Respects prefers-reduced-motion (jumps straight
 * to the target).
 */
export function useAnimatedNumber(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (Number.isNaN(target)) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
