"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;
const BUCKET_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), TICK_MS);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * "Now", rounded down to the minute, as an external store.
 *
 * Reading `Date.now()` straight in a component body is impure — two renders of
 * the same state can disagree, which is exactly what breaks under React's
 * concurrent rendering. Bucketing to the minute also keeps the snapshot stable
 * (a requirement of useSyncExternalStore) while still letting "due today" flip
 * over on its own during a long session.
 */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS,
    () => 0, // server render: nothing is "due" until the client takes over
  );
}
