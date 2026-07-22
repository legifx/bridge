"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Profile = { id: string; displayName: string; domains: string[] };

/**
 * Local profile switcher (no accounts — a learner is a local profile, §7).
 * Lists profiles, switches the cookie via /api/profiles, links to onboarding
 * for a fresh profile.
 */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((d) => {
        setProfiles(d.profiles ?? []);
        setCurrentId(d.currentId ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function switchTo(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ learnerId: id }),
    });
    window.location.href = "/";
  }

  const current = profiles.find((p) => p.id === currentId);
  const initial = (current?.displayName ?? "?").slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch profile"
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-text transition"
        style={{
          background: "rgba(255,255,255,0.08)",
          boxShadow: open
            ? "inset 0 0 0 1px rgba(139,92,255,0.5), 0 0 16px rgba(139,92,255,0.35)"
            : "inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {initial}
      </button>

      {open && (
        <div className="card absolute right-0 top-10 z-50 w-60 p-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => switchTo(p.id)}
              className="block w-full rounded-[14px] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">{p.displayName}</span>
                {p.id === currentId && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--acid)", boxShadow: "0 0 8px var(--acid)" }}
                  />
                )}
              </span>
              {p.domains.length > 0 && (
                <span className="mt-0.5 block truncate text-2xs text-faint">
                  {p.domains.join(" · ")}
                </span>
              )}
            </button>
          ))}
          <div className="my-1.5 h-px bg-hair" />
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="block rounded-[14px] px-3 py-2.5 text-sm font-medium text-interest-text transition hover:bg-white/[0.06]"
          >
            + New profile
          </Link>
        </div>
      )}
    </div>
  );
}
