"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Led } from "./Led";
import { useT } from "./LanguageProvider";

const NAV = [
  { href: "/", key: "nav.map" },
  { href: "/review", key: "nav.review" },
  { href: "/capture", key: "nav.capture" },
  { href: "/brain", key: "nav.brain" },
  // Teacher stays out of the nav until the feature is production-ready
  // (premium/future) — the route itself redirects home, see app/teacher.
] as const;

type Me = {
  learner: { id: string; displayName: string; language?: string } | null;
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
  const t = useT();
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
          {me?.learner && (
            <span className="flex items-center gap-2.5">
              <Link
                href="/settings"
                title={t("nav.settings")}
                aria-label={t("nav.settings")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-dim transition hover:bg-white/[0.1] hover:text-text"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </Link>
              {me.quota && (
                <span className="flex items-baseline gap-1" title={t("shell.aiBudget")}>
                  {me.quota.remaining === 0 ? (
                    <span className="font-mono text-2xs font-semibold text-orange-text">
                      {t("shell.aiEmpty")}
                    </span>
                  ) : (
                    <>
                      <Led
                        value={`${me.quota.remaining}`}
                        dot={2.4}
                        color={me.quota.remaining > 2 ? "#c9ff7a" : "#ffb877"}
                      />
                      <span className="font-mono text-2xs text-faint">/{me.quota.limit}</span>
                    </>
                  )}
                  <span className="font-mono text-2xs text-faint">{t("shell.aiLabel")}</span>
                </span>
              )}
              <button
                onClick={signOut}
                title={t("shell.signOut")}
                className="flex h-8 max-w-[110px] items-center gap-2 rounded-full px-3 text-xs font-semibold text-text transition hover:bg-white/[0.1]"
                style={{ background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}
              >
                <span className="truncate">{me.learner.displayName}</span>
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
            <p className="text-2xs leading-relaxed text-faint">{t("shell.publicDemo")}</p>
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
                className={`relative flex h-10 items-center rounded-full px-2.5 text-[13px] font-medium transition min-[400px]:px-3.5 min-[400px]:text-sm ${
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
                {t(n.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
