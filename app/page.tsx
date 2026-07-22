"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
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

// mastery -> glow: dim blue (new) climbing to acid green (mastered)
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
        <>
          <PageHead eyebrow="Concept map" title="Your learning order" />

          {/* interest domains */}
          <div className="-mt-4 mb-10 flex flex-wrap gap-2.5">
            {data.domains.map((d) => (
              <span key={d.id} className="chip chip-interest">
                {d.name}
                <Led value={`${Math.round(d.successRate * 100)}`} dot={2.4} color="#ffa6d8" suffix="%" />
              </span>
            ))}
          </div>

          {/* concept instrument list */}
          <ol className="space-y-5">
            {ordered.map((c, i) => {
              const pct = Math.round(c.mastery * 100);
              return (
                <li key={c.id} className="reveal" style={{ animationDelay: `${i * 55}ms` }}>
                  <Link
                    href={`/learn/${c.id}`}
                    className="aura card card-link ring-focus block p-6 hover:bg-white/[0.06]"
                    style={
                      {
                        "--glow": masteryGlow(c.mastery),
                        "--aura-x": "12%",
                        "--aura-y": "50%",
                        "--aura-strength": 0.3 + c.mastery * 0.45,
                      } as React.CSSProperties
                    }
                  >
                    <div className="flex items-start gap-5">
                      <span className="w-6 shrink-0 pt-1 font-mono text-2xs text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-semibold tracking-tight text-text">
                          {c.label}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-dim">
                          {c.definition}
                        </p>
                      </div>
                      <span className="flex min-w-[56px] shrink-0 justify-end pt-1">
                        <Led value={`${pct}`} dot={3.2} color={masteryColor(c.mastery)} suffix="%" />
                      </span>
                    </div>
                    <TickScale
                      value={c.mastery}
                      color={masteryGlow(c.mastery)}
                      count={44}
                      className="mt-5"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Shell>
  );
}

function EmptyState({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="mt-24 text-center">
      <div
        className="mx-auto mb-9 h-40 w-40"
        style={{
          borderRadius: "var(--r-xl)",
          background:
            "radial-gradient(circle at 50% 40%, rgba(59,123,255,0.55), transparent 65%), radial-gradient(circle at 60% 70%, rgba(255,59,172,0.5), transparent 60%)",
          filter: "blur(6px)",
        }}
      />
      <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-dim">{body}</p>
      <Link href={href} className="btn btn-primary mt-8">
        {cta}
      </Link>
    </div>
  );
}
