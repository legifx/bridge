"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";

type Concept = {
  id: string;
  label: string;
  definition: string;
  difficulty: number;
  mastery: number;
};
type Domain = { id: string; name: string; successRate: number };
type Data = {
  learner: { displayName: string };
  concepts: Concept[];
  edges: { from: string; to: string }[];
  order: string[];
  domains: Domain[];
};

function masteryStyle(m: number) {
  // low mastery = outline only; high = filled curriculum ink. Interest color is never used here.
  if (m >= 0.66) return "border-curriculum bg-curriculum text-white";
  if (m >= 0.4) return "border-curriculum bg-curriculum-soft text-curriculum";
  return "border-line bg-paper-raised text-ink";
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
      {loading && <p className="mt-10 text-center text-sm text-ink-soft">Loading…</p>}

      {!loading && data && data.domains.length === 0 && (
        <EmptyState
          title="Start with what you already know."
          body="Answer 5 quick taps and Bridge builds your interest profile. Then every concept is explained through your world."
          cta="Build my profile"
          href="/onboarding"
        />
      )}

      {!loading && data && data.domains.length > 0 && data.concepts.length === 0 && (
        <EmptyState
          title="Add something to learn."
          body="Snap a photo of a page or paste text. Bridge turns it into a concept map."
          cta="Capture material"
          href="/capture"
        />
      )}

      {!loading && data && data.domains.length > 0 && data.concepts.length > 0 && (
        <>
          <header className="mb-4">
            <h1 className="font-display text-2xl text-ink">Your concept map</h1>
            <p className="mt-1 text-sm text-ink-soft">
              In learning order, prerequisites first. Colored by how well you know each idea.
            </p>
          </header>

          <div className="mb-5 flex flex-wrap gap-2">
            {data.domains.map((d) => (
              <span
                key={d.id}
                className="rounded-full border border-interest bg-interest-soft px-3 py-1 text-xs font-medium text-interest"
              >
                {d.name}
                <span className="ml-1 font-mono text-[10px] opacity-70">
                  {Math.round(d.successRate * 100)}%
                </span>
              </span>
            ))}
          </div>

          <ol className="relative space-y-3 border-l border-line pl-5">
            {ordered.map((c, i) => (
              <li
                key={c.id}
                className="concept-node relative"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-curriculum bg-paper" />
                <Link
                  href={`/learn/${c.id}`}
                  className={`block rounded-[--radius] border p-4 transition ${masteryStyle(c.mastery)}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-base">{c.label}</h2>
                    <span className="font-mono text-xs opacity-70">
                      {Math.round(c.mastery * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-sm opacity-90">{c.definition}</p>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      <style jsx>{`
        .concept-node {
          opacity: 0;
          transform: translateY(6px);
          animation: rise 0.4s ease forwards;
        }
        @keyframes rise {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .concept-node {
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
    <div className="mt-16 text-center">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-block rounded-[--radius] bg-curriculum px-5 py-2.5 text-sm font-medium text-white"
      >
        {cta}
      </Link>
    </div>
  );
}
