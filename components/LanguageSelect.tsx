"use client";

import { LANGUAGES } from "@/lib/i18n";
import { useI18n } from "./LanguageProvider";

/**
 * The one language control — a native <select> dressed as a glass pill, so
 * phones get their platform picker (sheet/wheel) instead of a cramped custom
 * menu. `compact` renders the header variant (code only, e.g. "DE").
 */
export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <label
      className={`relative inline-flex cursor-pointer items-center gap-2 rounded-full transition hover:bg-white/[0.1] ${
        compact ? "h-8 px-3" : "h-12 w-full px-5"
      }`}
      style={{
        background: "rgba(255,255,255,0.07)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
      }}
    >
      <span aria-hidden className={compact ? "text-xs" : "text-base"}>
        🌐
      </span>
      <span className={`min-w-0 flex-1 truncate font-semibold text-text ${compact ? "text-xs" : "text-sm"}`}>
        {compact ? lang.toUpperCase() : (current?.label ?? lang)}
      </span>
      <svg aria-hidden width="10" height="6" viewBox="0 0 10 6" className="shrink-0 opacity-50">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <select
        aria-label={t("shell.language")}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-black text-white">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
