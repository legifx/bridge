"use client";

import { useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "tech", label: "Tech stack" },
  { id: "architecture", label: "Architecture" },
  { id: "status", label: "Status" },
  { id: "links", label: "Links" },
];

const TECH = [
  { name: "Next.js 16", role: "Framework (App Router, TS strict)" },
  { name: "Tailwind v4", role: "Styling" },
  { name: "SQLite + Prisma 6", role: "Database" },
  { name: "OpenRouter", role: "LLM provider (OpenAI-compatible)" },
  { name: "@xenova/transformers", role: "Local embeddings (all-MiniLM-L6-v2)" },
  { name: "Zod", role: "Schema validation" },
  { name: "Vitest", role: "Unit testing" },
];

const ARCHITECTURE = [
  { stage: "Stage 1", name: "lib/extraction", desc: "Vision → Concept Graph. Structured concept extraction, local embedding, dedupe, prerequisite DAG, topo sort." },
  { stage: "Stage 2", name: "lib/profile", desc: "Interest profile. Tap-based onboarding produces a vector store of interest domains (local embeddings)." },
  { stage: "Stage 3", name: "lib/bridge", desc: "Bridge engine + verification loop. Generates analogical explanations, fact-checks them, retries on rejection." },
  { stage: "Stage 4", name: "lib/adaptive", desc: "Thompson sampling, Elo mastery, SM-2-lite spaced repetition." },
  { stage: "lib/brain", name: "Second brain", desc: "Per-learner vector store, greedy weighted clustering, skill-tree rendering." },
];

const STATUS = [
  { label: "Stages 1–4", value: "Built & working end-to-end" },
  { label: "Full learner flow", value: "Onboarding → capture → concept map → learn session → retrieval check" },
  { label: "Verification log", value: "Complete" },
  { label: "Teacher view", value: "Aggregate-only, complete" },
  { label: "Split-screen compare", value: "Complete" },
  { label: "Seeded demo data", value: "Complete" },
];

export default function Project() {
  const [active, setActive] = useState("overview");

  return (
    <Shell>
      <PageHead
        eyebrow="Project"
        title="Bridge"
        sub="Learn new material through the knowledge you already hold. Prior-knowledge anchoring / analogical transfer — not learning styles."
      />

      {/* Tab bar */}
      <div className="mb-8 flex flex-wrap gap-1" role="tablist">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(s.id)}
              className={`slabel relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                isActive ? "text-text" : "text-faint hover:text-dim"
              }`}
            >
              {isActive && (
                <span
                  className="absolute inset-0 -z-10 rounded-full"
                  style={{
                    background: "rgba(10,132,255,0.12)",
                    boxShadow: "inset 0 0 0 1px rgba(10,132,255,0.3)",
                  }}
                />
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {active === "overview" && (
        <div className="space-y-8">
          <div className="aura card ring-focus p-6" style={{ "--glow": "var(--curriculum)", "--aura-x": "15%", "--aura-y": "30%", "--aura-strength": 0.35 } as React.CSSProperties}>
            <p className="eyebrow mb-3">Tagline</p>
            <p className="text-sm leading-relaxed text-dim">
              Bridge builds an interest and prior-knowledge profile of a learner, then re-expresses
              curriculum concepts through a domain that learner already understands deeply. The same
              chemistry chapter is explained to a competitive-gaming student and to a horse-riding
              student through <em>their</em> world — while the facts, the vocabulary being learned,
              and every assessment stay identical.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="card ring-focus p-5">
              <p className="eyebrow mb-2">Creator</p>
              <p className="text-lg font-semibold text-text">legifx</p>
              <p className="mt-1 text-sm text-dim">Your GitHub profile and sole maintainer.</p>
            </div>
            <div className="card ring-focus p-5">
              <p className="eyebrow mb-2">Repository</p>
              <p className="text-sm text-dim break-all">github.com/legifx/bridge</p>
              <p className="mt-1 text-sm text-dim">MIT licensed · Next.js 16</p>
            </div>
          </div>

          <div className="card ring-focus p-5">
            <p className="eyebrow mb-2">Live demo</p>
            <p className="text-sm text-dim break-all">bridge-livid-one.vercel.app</p>
            <p className="mt-1 text-sm text-dim">
              Explore two seeded profiles (competitive gaming vs horse riding). Tap "compare profiles"
              to see the same concept explained through two different worlds.
            </p>
          </div>

          <div className="card ring-focus p-5">
            <p className="eyebrow mb-2">Hackathon</p>
            <p className="text-sm text-dim">
              Built as a submission for an education-focused hackathon. The project demonstrates
              analogical transfer learning — using a learner's existing interests as bridges to
              new academic concepts.
            </p>
          </div>
        </div>
      )}

      {/* Tech stack */}
      {active === "tech" && (
        <div className="space-y-4">
          {TECH.map((t) => (
            <div key={t.name} className="card ring-focus flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-text">{t.name}</p>
                <p className="text-sm text-dim">{t.role}</p>
              </div>
              <span className="slabel text-curriculum-text">OK</span>
            </div>
          ))}
        </div>
      )}

      {/* Architecture */}
      {active === "architecture" && (
        <div className="space-y-4">
          {ARCHITECTURE.map((a) => (
            <div key={a.stage} className="aura card ring-focus p-5" style={{ "--glow": "var(--interest)", "--aura-x": "10%", "--aura-y": "40%", "--aura-strength": 0.25 } as React.CSSProperties}>
              <div className="flex items-baseline gap-4">
                <span className="slabel text-interest-text">{a.stage}</span>
                <code className="font-mono text-sm font-semibold text-text">{a.name}</code>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-dim">{a.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      {active === "status" && (
        <div className="space-y-4">
          {STATUS.map((s) => (
            <div key={s.label} className="card ring-focus flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-text">{s.label}</p>
                <p className="text-sm text-dim">{s.value}</p>
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--acid)", boxShadow: "0 0 8px var(--acid)" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Links */}
      {active === "links" && (
        <div className="space-y-3">
          <Link
            href="https://github.com/legifx/bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="card ring-focus block p-5 transition hover:bg-white/[0.06]"
          >
            <p className="font-semibold text-text">GitHub repository</p>
            <p className="text-sm text-dim">github.com/legifx/bridge</p>
          </Link>
          <Link
            href="https://bridge-livid-one.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="card ring-focus block p-5 transition hover:bg-white/[0.06]"
          >
            <p className="font-semibold text-text">Live demo</p>
            <p className="text-sm text-dim">bridge-livid-one.vercel.app</p>
          </Link>
          <Link
            href="https://github.com/legifx/bridge/blob/main/DECISIONS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="card ring-focus block p-5 transition hover:bg-white/[0.06]"
          >
            <p className="font-semibold text-text">Design decisions</p>
            <p className="text-sm text-dim">DECISIONS.md — reasoning behind every technical choice</p>
          </Link>
        </div>
      )}
    </Shell>
  );
}
