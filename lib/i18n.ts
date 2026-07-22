/**
 * Main-language support. The learner picks a language on the first onboarding
 * screen (editable later in the header); every learner-facing AI string is
 * generated in it. Client-safe — no server-only imports.
 */
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
