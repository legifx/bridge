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
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col">
      <header className="flex items-center justify-between px-6 pb-1 pt-6">
        <Link href="/" className="font-mono text-2xs uppercase tracking-[0.4em] text-dim">
          Bridge
        </Link>
        <Link
          href="/compare"
          className="font-mono text-2xs uppercase tracking-[0.25em] text-faint transition hover:text-interest"
        >
          compare ↗
        </Link>
      </header>

      <div className="flex-1 px-4 pb-32">{children}</div>

      <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <div className="glass lit flex items-center gap-1 rounded-full p-1.5" style={{ borderRadius: 999 }}>
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition ${
                  active ? "text-text" : "text-faint hover:text-dim"
                }`}
                style={{ borderRadius: 999 }}
              >
                {active && (
                  <span
                    className="absolute inset-0 -z-10 rounded-full"
                    style={{
                      borderRadius: 999,
                      background: "rgba(59,123,255,0.16)",
                      boxShadow: "inset 0 0 0 1px rgba(59,123,255,0.35), 0 0 20px rgba(59,123,255,0.35)",
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
