/**
 * Main-language support. The learner picks a language on the first onboarding
 * screen (editable later in the header). Two layers use it:
 *  - AI text: the LLM client appends a language instruction to every prompt.
 *  - UI text: every visible string resolves through the dictionaries below.
 * Client-safe — no server-only imports.
 */
import { en, type Dict } from "./dicts/en";
import { de } from "./dicts/de";
import { es } from "./dicts/es";
import { fr } from "./dicts/fr";
import { it } from "./dicts/it";
import { pt } from "./dicts/pt";
import { tr } from "./dicts/tr";
import { pl } from "./dicts/pl";
import { uk } from "./dicts/uk";
import { ar } from "./dicts/ar";

export type { Dict };

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "tr", label: "Türkçe" },
  { code: "pl", label: "Polski" },
  { code: "uk", label: "Українська" },
  { code: "ar", label: "العربية" },
];

const DICTS: Record<string, Dict> = { en, de, es, fr, it, pt, tr, pl, uk, ar };

const RTL = new Set(["ar"]);
export function isRTL(code: string): boolean {
  return RTL.has(code);
}

export function dictFor(code: string | null | undefined): Dict {
  return DICTS[code ?? "en"] ?? en;
}

/** Full language name for prompt injection — null for English (the default register). */
export function languageName(code: string | null | undefined): string | null {
  const hit = LANGUAGES.find((l) => l.code === code);
  return hit && hit.code !== "en" ? hit.label : null;
}

/** Best-guess default from the browser locale, constrained to supported codes. */
export function detectLanguage(locale: string | undefined): string {
  const base = (locale ?? "en").toLowerCase().split("-")[0];
  return LANGUAGES.some((l) => l.code === base) ? base : "en";
}

/** `{name}` interpolation. Missing vars are left as-is so mistakes stay visible. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Message keys — every Dict entry that is a plain string. */
export type MsgKey = { [K in keyof Dict]: Dict[K] extends string ? K : never }[keyof Dict];

/** Server-side lookup (API routes, engine prompts). Client code uses useT(). */
export function st(
  code: string | null | undefined,
  key: MsgKey,
  vars?: Record<string, string | number>,
): string {
  return format(dictFor(code)[key], vars);
}
