"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { Led } from "@/components/Led";
import { useT } from "@/components/LanguageProvider";

type Concept = {
  id: string;
  label: string;
  definition: string;
  mastery: number;
  reviewEnabled: boolean;
  dueAt: string | null;
};

type Data = {
  concepts: Concept[];
};

function masteryColor(m: number) {
  if (m >= 0.66) return "#c9ff7a";
  if (m >= 0.4) return "#9dc0ff";
  return "#ffb877";
}

export default function Review() {
  const t = useT();
  const [data, setData] = useState<Data | null>(null);
  function fmtDate(iso: string) {
    const d = new Date(iso);
    const diffDays = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return t("review.overdue");
    if (diffDays === 0) return t("review.today");
    if (diffDays === 1) return t("review.tomorrow");
    return t("review.inDays", { n: diffDays });
  }
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

  const now = Date.now();
  const inSrs = (data?.concepts ?? []).filter((c) => c.reviewEnabled);
  const due = inSrs
    .filter((c) => !c.dueAt || new Date(c.dueAt).getTime() <= now)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const upcoming = inSrs
    .filter((c) => c.dueAt && new Date(c.dueAt).getTime() > now)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const neverReviewed = (data?.concepts ?? []).filter(
    (c) => !c.reviewEnabled,
  );

  return (
    <Shell>
      <PageHead eyebrow={t("review.eyebrow")} title={t("review.title", { n: due.length })} />

      {loading && (
        <p className="mt-16 text-center text-sm text-faint">{t("common.loading")}</p>
      )}

      {!loading && due.length === 0 && (
        <div className="mt-24 text-center">
          <div
            className="mx-auto mb-8 h-32 w-32"
            style={{
              borderRadius: "var(--r-xl)",
              background:
                "radial-gradient(circle at 50% 40%, rgba(179,255,60,0.5), transparent 65%)",
              filter: "blur(8px)",
            }}
          />
          <h2 className="text-xl font-semibold tracking-tight text-text">
            {t("review.caughtUp")}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-dim">
            {upcoming.length > 0
              ? t("review.next", { when: fmtDate(upcoming[0]?.dueAt ?? "") })
              : t("review.enableNote")}
          </p>
        </div>
      )}

      {/* due now */}
      {due.length > 0 && (
        <div className="space-y-4">
          <p className="slabel text-faint">
            {t("review.due")}{" "}
            <span className="font-mono text-2xs text-acid-text">{t("review.concepts", { n: due.length })}</span>
          </p>
          {due.map((c) => {
            const pct = Math.round(c.mastery * 100);
            const isOverdue =
              c.dueAt && new Date(c.dueAt).getTime() < now - 86400000;
            return (
              <Link
                key={c.id}
                href={`/learn/${c.id}/check`}
                className="aura card card-link block p-5 transition hover:bg-white/[0.06]"
                style={
                  {
                    "--glow": isOverdue ? "var(--orange)" : "var(--acid)",
                    "--aura-strength": isOverdue ? 0.45 : 0.35,
                    "--aura-x": "15%",
                    "--aura-y": "40%",
                  } as React.CSSProperties
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold tracking-tight text-text">
                      {c.label}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-dim">
                      {c.definition}
                    </p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <Led
                      value={`${pct}`}
                      dot={3}
                      color={masteryColor(c.mastery)}
                      suffix="%"
                    />
                    {c.dueAt && (
                      <span
                        className={`font-mono text-2xs ${
                          isOverdue ? "text-orange-text" : "text-acid-text"
                        }`}
                      >
                        {fmtDate(c.dueAt)}
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* upcoming */}
      {upcoming.length > 0 && (
        <details className="group mt-10">
          <summary className="slabel cursor-pointer text-faint transition hover:text-dim">
            {t("review.upcoming", { n: upcoming.length })}
          </summary>
          <div className="mt-4 space-y-3">
            {upcoming.map((c) => {
              const pct = Math.round(c.mastery * 100);
              return (
                <Link
                  key={c.id}
                  href={`/learn/${c.id}/check`}
                  className="card card-link block p-4 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-text">
                      {c.label}
                    </p>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-2xs text-faint">
                        {fmtDate(c.dueAt ?? "")}
                      </span>
                      <Led
                        value={`${pct}`}
                        dot={2.4}
                        color={masteryColor(c.mastery)}
                        suffix="%"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </details>
      )}

      {/* not in rotation */}
      {neverReviewed.length > 0 && (
        <details className="group mt-8">
          <summary className="slabel cursor-pointer text-faint transition hover:text-dim">
            {t("review.notInRotation", { n: neverReviewed.length })}
          </summary>
        </details>
      )}
    </Shell>
  );
}
