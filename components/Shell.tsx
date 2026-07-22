"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Led } from "./Led";

const NAV = [
  { href: "/", label: "Map" },
  { href: "/review", label: "Review" },
  { href: "/capture", label: "Capture" },
  { href: "/brain", label: "Brain" },
  { href: "/teacher", label: "Teacher" },
];

type Me = {
  learner: { id: string; displayName: string } | null;
  publicDemo: boolean;
  quota: { used: number; limit: number; remaining: number } | null;
};

export function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
  }, [path]);

  async function signOut() {
    await fetch("/api/signout", { method: "POST" });
    window.location.href = "/signin";
  }

  return (
    <div
      className={`mx-auto flex min-h-dvh w-full flex-col ${
        wide ? "max-w-[960px]" : "max-w-[680px]"
      }`}
    >
      <header className="flex items-center justify-between px-5 pb-3 pt-8">
        <Link href="/" className="eyebrow transition hover:text-dim">
          Bridge
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/compare" className="slabel text-faint transition hover:text-interest-text">
            compare ↗
          </Link>
          {me?.learner && (
            <span className="flex items-center gap-2.5">
              {me.quota && (
                <span className="flex items-baseline gap-1" title="AI budget left on this demo profile">
                  <Led value={`${me.quota.remaining}`} dot={2.4} color={me.quota.remaining > 2 ? "#c9ff7a" : "#ffb877"} />
                  <span className="font-mono text-2xs text-faint">AI</span>
                </span>
              )}
              <button
                onClick={signOut}
                title="Sign out"
                className="flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold text-text transition hover:bg-white/[0.1]"
                style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}
              >
                {me.learner.displayName}
                <span className="text-faint">×</span>
              </button>
            </span>
          )}
        </div>
      </header>

      <div className="page-enter flex-1 px-5 pb-44 pt-3">
        {children}
        {me?.publicDemo && (
          <footer className="mt-14 px-2 text-center">
            <p className="text-2xs leading-relaxed text-faint">
              Public test demo · accounts are open (anyone who knows a name can open that profile)
              · please don&rsquo;t enter private data · each profile carries a small AI budget.
            </p>
          </footer>
        )}
      </div>

      <div className="fade-bottom" aria-hidden />
      <nav
        className="fixed inset-x-0 z-40 flex justify-center px-4"
        style={{ bottom: "max(1.1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="nav-glass flex items-center gap-0.5 p-1.5" style={{ borderRadius: 999 }}>
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative flex h-10 items-center rounded-full px-3.5 text-sm font-medium transition ${
                  active ? "text-text" : "text-faint hover:text-dim"
                }`}
                style={{ borderRadius: 999 }}
              >
                {active && (
                  <span
                    className="absolute inset-0 -z-10"
                    style={{
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.09)",
                      boxShadow:
                        "inset 0 0 0 1px rgba(255,255,255,0.12), 0 0 20px rgba(59,123,255,0.3)",
                    }}
                  />
                )}
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
