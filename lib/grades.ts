/**
 * Grade systems by country. The app scores everything internally as a fraction
 * (0..1); this maps that fraction to the grade of the learner's country, shown
 * in the LED readout. Researched 2026-07-24 (see AgentBrain reference note).
 *
 * Internal values never change — this is purely a display transform.
 */

export type GradeSystem = {
  code: string;
  /** short country/label for the settings picker */
  label: string;
} & (
  | {
      kind: "linear";
      min: number;
      max: number;
      decimals: number;
      higherIsBetter: boolean;
      suffix?: string;
    }
  | { kind: "band"; bands: { min: number; label: string }[] }
);

export const GRADE_SYSTEMS: GradeSystem[] = [
  { code: "percent", label: "Percentage (%)", kind: "linear", min: 0, max: 100, decimals: 0, higherIsBetter: true, suffix: "%" },
  { code: "us", label: "USA / UK (A–F)", kind: "band", bands: [
    { min: 0.9, label: "A" }, { min: 0.8, label: "B" }, { min: 0.7, label: "C" }, { min: 0.6, label: "D" }, { min: 0, label: "F" },
  ] },
  { code: "de", label: "Deutschland (1–6)", kind: "linear", min: 1, max: 6, decimals: 1, higherIsBetter: false },
  { code: "fr", label: "France (0–20)", kind: "linear", min: 0, max: 20, decimals: 1, higherIsBetter: true },
  { code: "it", label: "Italia (0–10)", kind: "linear", min: 0, max: 10, decimals: 1, higherIsBetter: true },
  { code: "es", label: "España (0–10)", kind: "linear", min: 0, max: 10, decimals: 1, higherIsBetter: true },
  { code: "pt", label: "Portugal (0–20)", kind: "linear", min: 0, max: 20, decimals: 1, higherIsBetter: true },
  { code: "pl", label: "Polska (1–6)", kind: "linear", min: 1, max: 6, decimals: 1, higherIsBetter: true },
  { code: "ua", label: "Україна (1–12)", kind: "linear", min: 1, max: 12, decimals: 0, higherIsBetter: true },
  { code: "tr", label: "Türkiye (AA–FF)", kind: "band", bands: [
    { min: 0.9, label: "AA" }, { min: 0.85, label: "BA" }, { min: 0.8, label: "BB" }, { min: 0.75, label: "CB" },
    { min: 0.65, label: "CC" }, { min: 0.58, label: "DC" }, { min: 0.5, label: "DD" }, { min: 0, label: "FF" },
  ] },
];

const BY_CODE = new Map(GRADE_SYSTEMS.map((g) => [g.code, g]));

export function gradeSystemFor(code: string | null | undefined): GradeSystem {
  return BY_CODE.get(code ?? "percent") ?? GRADE_SYSTEMS[0];
}

/** Sensible default grade system from the UI language (fallback percentage). */
export function defaultGradeSystem(language: string | null | undefined): string {
  const map: Record<string, string> = {
    de: "de", fr: "fr", it: "it", es: "es", pt: "pt", pl: "pl", uk: "ua", tr: "tr", en: "us",
  };
  return map[language ?? ""] ?? "percent";
}

export type GradeDisplay = { value: string; suffix?: string };

/** Map an internal score fraction (0..1) to the country's grade for display. */
export function formatGrade(score: number, code: string | null | undefined): GradeDisplay {
  const s = Math.max(0, Math.min(1, score));
  const sys = gradeSystemFor(code);
  if (sys.kind === "band") {
    const band = sys.bands.find((b) => s >= b.min) ?? sys.bands[sys.bands.length - 1];
    return { value: band.label };
  }
  const raw = sys.higherIsBetter ? sys.min + (sys.max - sys.min) * s : sys.max - (sys.max - sys.min) * s;
  // German grades use a comma decimal; the LED renders "," — keep it locale-friendly.
  const fixed = raw.toFixed(sys.decimals);
  const value = sys.code === "de" ? fixed.replace(".", ",") : fixed;
  return { value, suffix: sys.suffix };
}
