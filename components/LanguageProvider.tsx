"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { detectLanguage, dictFor, format, isRTL, type Dict, type MsgKey } from "@/lib/i18n";

/**
 * One source of truth for the UI language. Resolution order:
 *  1. localStorage (instant, no flash of English on repeat visits)
 *  2. the signed-in learner's stored language from /api/me
 *  3. the browser locale
 * Picking a language anywhere (onboarding dropdown, header) updates the whole
 * app immediately, persists locally, and PATCHes the learner when signed in.
 */

const STORAGE_KEY = "bridge.lang";

type I18n = {
  lang: string;
  dict: Dict;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
  setLang: (code: string, opts?: { persistRemote?: boolean }) => void;
};

const Ctx = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("en");

  // hydrate. A local choice (localStorage) ALWAYS wins for the UI — otherwise
  // opening a profile stored in another language (e.g. the seeded English demo
  // profiles) would yank the UI back to that language mid-session. When there
  // is a local choice we instead push it TO the profile, so server-generated
  // text (brain summary, new captures) follows the UI language too. Only when
  // there is no local choice yet do we adopt the learner's stored language.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLangState(stored);
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => {
          const remote = d?.learner?.language;
          if (typeof remote === "string" && remote !== stored) {
            // signed in, but the profile is on a different language → align it
            fetch("/api/me", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ language: stored }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
      return;
    }
    setLangState(detectLanguage(navigator.language));
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        const remote = d?.learner?.language;
        if (typeof remote === "string" && remote.length >= 2) {
          setLangState(remote);
          window.localStorage.setItem(STORAGE_KEY, remote);
        }
      })
      .catch(() => {});
  }, []);

  // the document direction follows the language (Arabic is RTL)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((code: string, opts?: { persistRemote?: boolean }) => {
    setLangState(code);
    window.localStorage.setItem(STORAGE_KEY, code);
    if (opts?.persistRemote !== false) {
      // 401 when signed out is fine — localStorage carries it into onboarding
      fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: code }),
      }).catch(() => {});
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dictFor(lang);
    return {
      lang,
      dict,
      t: (key, vars) => format(dict[key], vars),
      setLang,
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
