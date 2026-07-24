"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { Grade } from "@/components/Grade";
import { useT } from "@/components/LanguageProvider";

type ProblemDetail = { correct: boolean; feedback: string | null };
type Detail = {
  freeCorrect?: boolean;
  freeFeedback?: string;
  mcqCorrect?: boolean;
  problems?: ProblemDetail[];
};
type LogEntry = {
  id: string;
  conceptId: string;
  label: string;
  correct: boolean;
  answeredAt: string;
  dueAt: string;
  mastery: number;
  reviewEnabled: boolean;
  detail: Detail | null;
};

function masteryColor(m: number) {
  if (m >= 0.66) return "#c9ff7a";
  if (m >= 0.4) return "#9dc0ff";
  return "#ffb877";
}

export default function Review() {
  const t = useT();
  const router = useRouter();
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => {
        if (r.status === 401) window.location.href = "/signin";
        return r.json();
      })
      .then((d) => setLog(d.log ?? []));
  }, []);

  function fmtDue(iso: string) {
    const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
    if (diff < 0) return t("review.overdue");
    if (diff === 0) return t("review.today");
    if (diff === 1) return t("review.tomorrow");
    return t("review.inDays", { n: diff });
  }
  function fmtWhen(iso: string) {
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff <= 0) return t("review.today");
    if (diff === 1) return t("review.yesterday");
    return t("review.daysAgo", { n: diff });
  }

  const dueCount = (log ?? []).filter(
    (e) => e.reviewEnabled && new Date(e.dueAt).getTime() <= Date.now(),
  ).length;

  return (
    <Shell>
      <PageHead
        eyebrow={t("review.eyebrow")}
        title={t("review.logTitle")}
        sub={dueCount > 0 ? t("review.dueNote", { n: dueCount }) : t("review.logSub")}
      />

      {!log && <p className="mt-10 text-center text-sm text-faint">{t("common.loading")}</p>}

      {log && log.length === 0 && (
        <div className="card mt-8 p-8 text-center">
          <p className="text-sm text-dim">{t("review.emptyLog")}</p>
        </div>
      )}

      {log && log.length > 0 && (
        <div className="mt-4 space-y-3">
          {log.map((e) => {
            const isOpen = open === e.id;
            const due = e.reviewEnabled && new Date(e.dueAt).getTime() <= Date.now();
            return (
              <div key={e.id} className="card overflow-hidden">
                {/* row */}
                <button
                  onClick={() => setOpen(isOpen ? null : e.id)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: e.correct ? "#c9ff7a" : "#ffb877",
                      boxShadow: `0 0 8px ${e.correct ? "#c9ff7a" : "#ffb877"}`,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{e.label}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-2xs text-faint">
                      <span>{fmtWhen(e.answeredAt)}</span>
                      {e.reviewEnabled && (
                        <span className={due ? "text-orange-text" : "text-faint"}>
                          · {t("review.due")} {fmtDue(e.dueAt)}
                        </span>
                      )}
                    </span>
                  </span>
                  <Grade score={e.mastery} dot={2.6} color={masteryColor(e.mastery)} />
                </button>

                {/* detail */}
                {isOpen && (
                  <div className="border-t border-hair p-4">
                    {e.detail ? (
                      <div className="space-y-2">
                        <DetailRow label={t("check.recallLabel")} ok={e.detail.freeCorrect} />
                        <DetailRow label={t("review.multipleChoice")} ok={e.detail.mcqCorrect} />
                        {e.detail.problems?.map((p, i) => (
                          <DetailRow key={i} label={`${t("check.task")} ${i + 1}`} ok={p.correct} note={p.feedback} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-faint">{t("review.noDetail")}</p>
                    )}

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => router.push(`/learn/${e.conceptId}?relearn=1`)}
                        className="btn btn-glass flex-1"
                      >
                        ↺ {t("review.relearnBtn")}
                      </button>
                      <button
                        onClick={() => router.push(`/learn/${e.conceptId}/check?mode=tasks`)}
                        className="btn btn-primary flex-1"
                      >
                        {t("review.tasksBtn")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function DetailRow({
  label,
  ok,
  note,
}: {
  label: string;
  ok: boolean | undefined;
  note?: string | null;
}) {
  if (ok === undefined) return null;
  return (
    <div className="flex items-start gap-2">
      <span className={`slabel shrink-0 ${ok ? "text-acid-text" : "text-orange-text"}`}>
        {ok ? "✓" : "✕"}
      </span>
      <span className="min-w-0 text-xs text-dim">
        {label}
        {note ? <span className="text-faint"> — {note}</span> : null}
      </span>
    </div>
  );
}
