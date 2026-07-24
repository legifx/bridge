"use client";

import { Led } from "./Led";
import { useI18n } from "./LanguageProvider";
import { formatGrade } from "@/lib/grades";

/**
 * Show an internal score fraction (0..1) as the learner's country grade in the
 * LED readout — a number/letter in their own grading system, set in Settings.
 */
export function Grade({
  score,
  dot = 4,
  color = "currentColor",
}: {
  score: number;
  dot?: number;
  color?: string;
}) {
  const { gradeSystem } = useI18n();
  const g = formatGrade(score, gradeSystem);
  return <Led value={g.value} dot={dot} color={color} suffix={g.suffix} />;
}
