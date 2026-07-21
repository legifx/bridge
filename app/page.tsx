"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Led } from "@/components/Led";
import { TickScale } from "@/components/TickScale";

type Concept = { id: string; label: string; definition: string; difficulty: number; mastery: number };
type Domain = { id: string; name: string; successRate: number };
type Data = {
  learner: { displayName: string };
  concepts: Concept[];
  edges: { from: string; to: string }[];
  order: string[];
  domains: Domain[];
};

// mastery -> glow color: dim blue (new) climbing to acid green (mastered)
function masteryGlow(m: number) {
  if (m >= 0.66) return "var(--acid)";
  if (m >= 0.4) return "var(--curriculum)";
  return "#2a4a8f";
}
function masteryColor(m: number) {
  return m >= 0.66 ? "#c9ff7a" : "#9dc0ff";
}

export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const byId = new Map(data?.concepts.map((c) => [c.id, c]) ?? []);
  const ordered = data ? data.order.map((id) => byId.get(id)!).filter(Boolean) : [];

  return (
    <Shell>
      {loading && <p className="mt-16 text-center text-sm text-faint">Loading…</p>}

      {!loading && data && data.domains.length === 0 && (
        <EmptyState
          title="Start with what you already know."
          body="Five taps builds your interest profile. Then every concept is re-lit through your world."
          cta="Build my profile"
          href="/onboarding"
        />
      )}

      {!loading && data && data.domains.length > 0 && data.concepts.length === 0 && (
        <EmptyState
          title="Add something to learn."
          body="Snap a page or paste text. Bridge turns it into a concept map."
          cta="Capture material"
          href="/capture"
        />
      )}

      {!loading && data && data.domains.length > 0 && data.concepts.length > 0 && (
        <div className="px-2">
          <header className="mb-5 mt-2">
            <p className="font-mono text-2xs uppercase tracking-[0.3em] text-faint">Concept map</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">
              In order, prerequisites first
            </h1>
          </header>

          {/* interest domains */}
          <div className="mb-6 flex flex-wrap gap-2">
            {data.domains.map((d) => (
              <span
                key={d.id}
                className="flex items-center gap-2 rounded-full bg-[rgba(255,59,172,0.12)] px-3 py-1.5 text-xs font-medium text-[#ffa6d8] shadow-[0_0_16px_rgba(255,59,172,0.25)]"
              >
                {d.name}
                <Led value={`${Math.round(d.successRate * 100)}`} dot={2.4} color="#ffa6d8" />
              </span>
            ))}
          </div>

          {/* concept instrument list */}
          <ol className="space-y-3">
            {ordered.map((c, i) => {
              const pct = Math.round(c.mastery * 100);
              return (
                <li key={c.id} className="reveal" style={{ animationDelay: `${i * 55}ms` }}>
                  <Link
                    href={`/learn/${c.id}`}
                    className="aura glass lit block rounded-[--r-lg] p-4 ring-focus"
                    style={
                      {
                        "--glow": masteryGlow(c.mastery),
                        "--aura-x": "18%",
                        "--aura-y": "50%",
                        "--aura-strength": 0.5 + c.mastery * 0.5,
                      } as React.CSSProperties
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-2xs text-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-text">{c.label}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-dim">{c.definition}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 pt-1">
                        <span className="flex items-baseline gap-1">
                          <Led value={`${pct}`} dot={3.2} color={masteryColor(c.mastery)} />
                          <span className="font-mono text-2xs text-faint">%</span>
                        </span>
                      </div>
                    </div>
                    <TickScale value={c.mastery} color={masteryGlow(c.mastery)} count={40} className="mt-3" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <style jsx>{`
        .reveal {
          opacity: 0;
          transform: translateY(8px);
          animation: rise 0.5s ease forwards;
        }
        @keyframes rise {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `}</style>
    </Shell>
  );
}

function EmptyState({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="mt-24 px-4 text-center">
      <div
        className="mx-auto mb-8 h-40 w-40 rounded-[--r-xl]"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(59,123,255,0.55), transparent 65%), radial-gradient(circle at 60% 70%, rgba(255,59,172,0.5), transparent 60%)",
          filter: "blur(6px)",
        }}
      />
      <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-dim">{body}</p>
      <Link
        href={href}
        className="mt-7 inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}
