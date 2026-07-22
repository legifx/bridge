"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Led } from "./Led";
import { LanguageSelect } from "./LanguageSelect";
import { useT } from "./LanguageProvider";

const NAV = [
  { href: "/", key: "nav.map" },
  { href: "/review", key: "nav.review" },
  { href: "/capture", key: "nav.capture" },
  { href: "/brain", key: "nav.brain" },
  { href: "/teacher", key: "nav.teacher" },
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
          <Link
            href="/compare"
            className="slabel hidden text-faint transition hover:text-interest-text min-[440px]:inline"
          >
            {t("nav.compare")}
          </Link>
          {me?.learner && (
            <span className="flex items-center gap-2.5">
              <LanguageSelect compact />
              {me.quota && (
                <span className="flex items-baseline gap-1" title={t("shell.aiBudget")}>
                  <Led value={`${me.quota.remaining}`} dot={2.4} color={me.quota.remaining > 2 ? "#c9ff7a" : "#ffb877"} />
                  <span className="font-mono text-2xs text-faint">AI</span>
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
