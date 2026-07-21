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
    <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.25em] text-curriculum">
          Bridge
        </Link>
        <Link href="/compare" className="font-mono text-xs text-ink-soft underline underline-offset-4">
          compare profiles
        </Link>
      </header>

      <div className="flex-1 px-5 pb-28">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-stretch">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex-1 py-3 text-center text-sm font-medium ${
                  active ? "text-curriculum" : "text-ink-soft"
                }`}
              >
                <span
                  className={`mx-auto mb-1 block h-0.5 w-6 rounded-full ${
                    active ? "bg-curriculum" : "bg-transparent"
                  }`}
                />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
