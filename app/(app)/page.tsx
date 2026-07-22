"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { Led } from "@/components/Led";
import { TickScale } from "@/components/TickScale";
import { useT } from "@/components/LanguageProvider";

type Concept = {
  id: string;
  label: string;
  definition: string;
  difficulty: number;
  mastery: number;
  sourceId: string | null;
  reviewEnabled: boolean;
  dueAt: string | null;
};
type Source = {
  id: string;
  title: string;
  subject: string | null;
  kind: string;
  createdAt: string;
  count: number;
};
type Domain = { id: string; name: string; successRate: number };
type Data = {
  learner: { displayName: string };
  concepts: Concept[];
  sources: Source[];
  edges: { from: string; to: string }[];
  order: string[];
  domains: Domain[];
};

function masteryGlow(m: number) {
  if (m >= 0.66) return "var(--acid)";
  if (m >= 0.4) return "var(--curriculum)";
  return "#2a4a8f";
}
function masteryColor(m: number) {
  return m >= 0.66 ? "#c9ff7a" : "#9dc0ff";
}
export default function Home() {
  const t = useT();
  const [data, setData] = useState<Data | null>(null);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => {
        if (r.status === 401) window.location.href = "/signin";
        return r.json();
      })
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const byId = new Map(data?.concepts.map((c) => [c.id, c]) ?? []);
  const ordered = data ? data.order.map((id) => byId.get(id)!).filter(Boolean) : [];

  // spaced repetition: opted-in concepts whose next review is due (or unstarted)
  const now = Date.now();
  const due = ordered.filter(
    (c) => c.reviewEnabled && (!c.dueAt || new Date(c.dueAt).getTime() <= now),
  );

  // group the learning order into capture folders…
  const folders = (data?.sources ?? [])
    .map((s) => ({ source: s, concepts: ordered.filter((c) => c.sourceId === s.id) }))
    .filter((f) => f.concepts.length > 0);
  const loose = ordered.filter((c) => !c.sourceId);

  // …and folders into their parent subject ("Überordner") — one clean block per topic
  const subjects: { subject: string; folders: typeof folders }[] = [];
  for (const f of folders) {
    const name = f.source.subject?.trim() || t("map.otherTopics");
    const hit = subjects.find((s) => s.subject.toLowerCase() === name.toLowerCase());
    if (hit) hit.folders.push(f);
    else subjects.push({ subject: name, folders: [f] });
  }
  const SUBJECT_GLOWS = ["var(--curriculum)", "var(--interest)", "var(--violet)", "var(--orange)", "var(--acid)"];

  let seq = 0;

  return (
    <Shell>
      {loading && <p className="mt-16 text-center text-sm text-faint">{t("common.loading")}</p>}

      {!loading && data && data.domains.length === 0 && (
        <EmptyState
          title={t("map.emptyProfileTitle")}
          body={t("map.emptyProfileBody")}
          cta={t("map.buildProfile")}
          href="/onboarding"
        />
      )}

      {!loading && data && data.domains.length > 0 && data.concepts.length === 0 && (
        <EmptyState
          title={t("map.emptyCaptureTitle")}
          body={t("map.emptyCaptureBody")}
          cta={t("map.captureCta")}
          href="/capture"
        />
      )}

      {!loading && data && data.domains.length > 0 && data.concepts.length > 0 && (
        <>
          <PageHead eyebrow={t("map.eyebrow")} title={t("map.title")} />

          <div className="-mt-4 mb-8 flex flex-wrap gap-2.5">
            {data.domains.map((d) => (
              <span key={d.id} className="chip chip-interest">
                {d.name}
                <Led value={`${Math.round(d.successRate * 100)}`} dot={2.4} color="#ffa6d8" suffix="%" />
              </span>
            ))}
          </div>

          {/* due for review — the spaced-repetition queue */}
          {due.length > 0 && (
            <div
              className="aura card mb-8 p-5"
              style={
                {
                  "--glow": "var(--acid)",
                  "--aura-x": "10%",
                  "--aura-y": "30%",
                  "--aura-strength": 0.45,
                } as React.CSSProperties
              }
            >
              <div className="mb-3 flex items-baseline justify-between">
                <p className="slabel text-acid-text">{t("map.due")}</p>
                <Led value={`${due.length}`} dot={3} color="#c9ff7a" />
              </div>
              <div className="flex flex-wrap gap-2">
                {due.map((c) => (
                  <Link
                    key={c.id}
                    href={`/learn/${c.id}/check`}
                    className="chip"
                    style={{
                      background: "rgba(179,255,60,0.12)",
                      color: "var(--acid-text)",
                      boxShadow: "0 0 16px rgba(179,255,60,0.2)",
                    }}
                  >
                    {c.label} ↗
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* subjects ("Überordner") -> capture folders -> concepts */}
          <div className="space-y-14">
            {subjects.map((s, si) => {
              const glow = SUBJECT_GLOWS[si % SUBJECT_GLOWS.length];
              return (
                <section key={s.subject}>
                  {/* subject header: an unmissable topic divider */}
                  <div className="mb-6 flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: glow, boxShadow: `0 0 14px ${glow}` }}
                    />
                    <h2 className="text-xl font-semibold tracking-tight text-text">{s.subject}</h2>
                    <span className="slabel text-faint">
                      {t("map.folders", { n: s.folders.length })}
                    </span>
                    <span className="h-px flex-1 bg-hair" />
                  </div>

                  <div
                    className="space-y-10 border-l pl-4 min-[440px]:pl-5"
                    style={{ borderColor: `color-mix(in oklab, ${glow} 35%, transparent)` }}
                  >
                    {s.folders.map((f) => (
                      <section key={f.source.id}>
                        <div className="mb-4 flex items-end justify-between gap-3 px-1">
                          <div className="min-w-0">
                            <p className="slabel text-faint">
                              {f.source.kind === "photo" ? t("map.photoCapture") : t("map.capture")} ·{" "}
                              {fmtDate(f.source.createdAt)}
                            </p>
                            <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-text">
                              {f.source.title}
                            </h3>
                          </div>
                          <Link
                            href={`/capture?source=${f.source.id}`}
                            className="slabel shrink-0 pb-0.5 text-curriculum-text transition hover:opacity-80"
                          >
                            {t("map.addMaterial")}
                          </Link>
                        </div>
                        <ol className="space-y-5">
                          {f.concepts.map((c) => {
                            seq += 1;
                            return <ConceptCard key={c.id} c={c} index={seq} />;
                          })}
                        </ol>
                      </section>
                    ))}
                  </div>
                </section>
              );
            })}

            {loose.length > 0 && (
              <section>
                <p className="slabel mb-4 px-1 text-faint">{t("map.otherConcepts")}</p>
                <ol className="space-y-5">
                  {loose.map((c) => {
                    seq += 1;
                    return <ConceptCard key={c.id} c={c} index={seq} />;
                  })}
                </ol>
              </section>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function ConceptCard({ c, index }: { c: Concept; index: number }) {
  const pct = Math.round(c.mastery * 100);
  return (
    <li className="reveal" style={{ animationDelay: `${Math.min(index * 45, 500)}ms` }}>
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
            {String(index).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold tracking-tight text-text">{c.label}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-dim">{c.definition}</p>
          </div>
          <span className="flex min-w-[56px] shrink-0 flex-col items-end gap-1 pt-1">
            <Led value={`${pct}`} dot={3.2} color={masteryColor(c.mastery)} suffix="%" />
            {c.reviewEnabled && (
              <span className="slabel" style={{ color: "var(--acid-text)", fontSize: "0.5625rem" }}>
                ↻ srs
              </span>
            )}
          </span>
        </div>
        <TickScale value={c.mastery} color={masteryGlow(c.mastery)} count={44} className="mt-5" />
      </Link>
    </li>
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
