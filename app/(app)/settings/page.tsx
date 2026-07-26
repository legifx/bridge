"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useI18n } from "@/components/LanguageProvider";
import { GRADE_SYSTEMS, formatGrade } from "@/lib/grades";

export default function Settings() {
  const { t, gradeSystem, setGradeSystem } = useI18n();
  const [readingLevel, setReadingLevel] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // The current level comes from the profile; the setter writes straight
  // through so the next explanation already follows it.
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.learner?.readingLevel === "number") setReadingLevel(d.learner.readingLevel);
      })
      .catch(() => {});
  }, []);

  function chooseReadingLevel(level: number) {
    setReadingLevel(level);
    fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readingLevel: level }),
    }).catch(() => {});
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? t("common.somethingWrong"));
        return;
      }
      window.location.href = "/signin";
    } catch {
      setDeleteError(t("common.somethingWrong"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Shell>
      <PageHead eyebrow={t("settings.eyebrow")} title={t("settings.title")} sub={t("settings.sub")} />

      <div className="mt-6 space-y-5">
        {/* language */}
        <div className="card p-5">
          <p className="slabel text-faint">{t("settings.language")}</p>
          <div className="mt-3 max-w-[280px]">
            <LanguageSelect />
          </div>
        </div>

        {/* country grade system */}
        <div className="card p-5">
          <p className="slabel text-faint">{t("settings.gradeSystem")}</p>
          <p className="mt-1 text-xs leading-relaxed text-faint">{t("settings.gradeSystemSub")}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GRADE_SYSTEMS.map((g) => {
              const active = gradeSystem === g.code;
              const sample = formatGrade(0.85, g.code); // preview a "good" grade
              return (
                <button
                  key={g.code}
                  onClick={() => setGradeSystem(g.code)}
                  className={`opt flex items-center justify-between ${active ? "opt-active-blue" : ""}`}
                >
                  <span>{g.label}</span>
                  <span className="font-mono text-2xs text-faint">
                    {sample.value}
                    {sample.suffix ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* reading level — set once at onboarding, and until now never again */}
        <div className="card p-5">
          <p className="slabel text-faint">{t("settings.readingLevel")}</p>
          <p className="mt-1 text-xs leading-relaxed text-faint">{t("settings.readingLevelSub")}</p>
          <div className="mt-4 flex items-center gap-2" role="radiogroup" aria-label={t("settings.readingLevel")}>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                role="radio"
                aria-checked={readingLevel === lvl}
                onClick={() => chooseReadingLevel(lvl)}
                className={`flex-1 rounded-full py-2.5 text-sm transition ${
                  readingLevel === lvl ? "text-curriculum-text" : "text-dim"
                }`}
                style={{
                  background: readingLevel === lvl ? "rgba(90,140,255,0.14)" : "rgba(255,255,255,0.05)",
                  boxShadow:
                    readingLevel === lvl
                      ? "inset 0 0 0 1px rgba(90,140,255,0.4)"
                      : "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            <span className="slabel text-faint">{t("settings.simpler")}</span>
            <span className="slabel text-faint">{t("settings.harder")}</span>
          </div>
        </div>

        {/* your data: take it with you, or remove it */}
        <div className="card p-5">
          <p className="slabel text-faint">{t("settings.yourData")}</p>
          <p className="mt-1 text-xs leading-relaxed text-faint">{t("settings.yourDataSub")}</p>

          <a href="/api/me/export" download className="btn btn-glass mt-4 w-full">
            {t("settings.exportData")}
          </a>

          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="btn btn-glass mt-3 w-full text-reject-text">
              {t("settings.deleteAccount")}
            </button>
          ) : (
            <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,51,85,0.08)" }}>
              <p className="text-sm leading-relaxed text-reject-text">{t("settings.deleteWarning")}</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("signin.passwordPlaceholder")}
                aria-label={t("signin.password")}
                className="input mt-3 w-full text-sm"
              />
              {deleteError && <p className="mt-2 text-xs text-reject-text">{deleteError}</p>}
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => {
                    setConfirming(false);
                    setPassword("");
                    setDeleteError(null);
                  }}
                  className="btn btn-glass flex-1"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleting}
                  className={`btn btn-primary flex-1 ${deleting ? "btn-working" : ""}`}
                >
                  {t("settings.deleteConfirm")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
