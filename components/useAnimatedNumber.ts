"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Does the visitor ask for reduced motion? Read as an external store rather
 * than mirrored into state, so nothing has to be written during render or from
 * inside an effect (and it stays correct if the OS setting flips mid-session).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(REDUCED_MOTION).matches
      : false),
    () => false, // server render: assume motion is fine, the effect never runs there
  );
}

/**
 * Animate a number from 0 to `target` with an ease-out curve. Returns the
 * current in-flight value. Respects prefers-reduced-motion (jumps straight
 * to the target).
 */
export function useAnimatedNumber(target: number, duration = 900): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced || Number.isNaN(target)) return;
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
  }, [target, duration, reduced]);

  // With reduced motion (or a NaN target) there is nothing to animate — show
  // the destination straight away instead of writing it into state.
  if (reduced || Number.isNaN(target)) return Number.isNaN(target) ? 0 : target;
  return value;
}
