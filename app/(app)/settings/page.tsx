"use client";

import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useI18n } from "@/components/LanguageProvider";
import { GRADE_SYSTEMS, formatGrade } from "@/lib/grades";

export default function Settings() {
  const { t, gradeSystem, setGradeSystem } = useI18n();

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
      </div>
    </Shell>
  );
}
