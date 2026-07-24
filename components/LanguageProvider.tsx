"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
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
  /** country grade system for score display (see lib/grades.ts) */
  gradeSystem: string;
  setGradeSystem: (code: string) => void;
};

const Ctx = createContext<I18n | null>(null);

/**
 * The chosen language lives in localStorage, not in React state: it has to be
 * readable on the very first client render (no flash of English) while the
 * server render has no access to it. Exposing it as an external store keeps the
 * component pure — no writing state from an effect just to hydrate.
 */
const langListeners = new Set<() => void>();
function subscribeLang(onChange: () => void) {
  langListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    langListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function notifyLang() {
  for (const l of langListeners) l();
}
function readLang(): string {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) ?? detectLanguage(navigator.language);
}
function writeLang(code: string) {
  window.localStorage.setItem(STORAGE_KEY, code);
  notifyLang();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "en");
  const [gradeSystem, setGradeSystemState] = useState("percent");

  // A local choice (localStorage) ALWAYS wins for the UI — otherwise opening a
  // profile stored in another language (e.g. the seeded English demo profiles)
  // would yank the UI back to that language mid-session. When there is a local
  // choice we instead push it TO the profile, so server-generated text (brain
  // summary, new captures) follows the UI language too. Only when there is no
  // local choice yet do we adopt the learner's stored language.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => {
          if (typeof d?.learner?.gradeSystem === "string") setGradeSystemState(d.learner.gradeSystem);
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
    // No local choice yet (the browser locale is showing) → adopt the profile's.
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.learner?.gradeSystem === "string") setGradeSystemState(d.learner.gradeSystem);
        const remote = d?.learner?.language;
        if (typeof remote === "string" && remote.length >= 2) writeLang(remote);
      })
      .catch(() => {});
  }, []);

  const setGradeSystem = useCallback((code: string) => {
    setGradeSystemState(code);
    fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gradeSystem: code }),
    }).catch(() => {});
  }, []);

  // the document direction follows the language (Arabic is RTL)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((code: string, opts?: { persistRemote?: boolean }) => {
    writeLang(code);
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
      gradeSystem,
      setGradeSystem,
    };
  }, [lang, setLang, gradeSystem, setGradeSystem]);

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
