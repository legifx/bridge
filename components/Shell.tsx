"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Map" },
  { href: "/capture", label: "Capture" },
  { href: "/verification", label: "Log" },
  { href: "/teacher", label: "Teacher" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <Link href="/" className="eyebrow transition hover:text-dim">
          Bridge
        </Link>
        <Link href="/compare" className="slabel text-faint transition hover:text-interest-text">
          compare ↗
        </Link>
      </header>

      <div className="page-enter flex-1 px-5 pb-40 pt-2">{children}</div>

      <nav
        className="fixed inset-x-0 z-40 flex justify-center px-5"
        style={{ bottom: "max(1.1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="glass lit flex items-center gap-1 p-1.5" style={{ borderRadius: 999 }}>
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative flex h-10 items-center rounded-full px-4 text-sm font-medium transition ${
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
