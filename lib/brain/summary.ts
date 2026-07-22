/**
 * "What the algorithm thinks you're into" — a deliberately transparent,
 * numbers-backed summary generated from the tree itself. No LLM: every claim
 * is traceable to a weight, a posterior, or a mastery score, which fits the
 * product's honesty ethos (and costs nothing, everywhere, in every mode).
 */
import type { BrainTree } from "./tree";

export type BrainSummary = {
  headline: string;
  lines: string[];
};

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function summarizeBrain(tree: BrainTree, displayName: string): BrainSummary {
  const { branches, stats } = tree;

  if (branches.length === 0) {
    return {
      headline: "Nothing recorded yet.",
      lines: [
        "Answer the onboarding taps or learn a concept — every signal lands here and the picture sharpens as you go.",
      ],
    };
  }

  const [top, ...rest] = branches;
  const lines: string[] = [];

  const clickNote =
    top.successRate !== null
      ? ` When Bridge explains things through it, ${pct(top.successRate)} of those bridges clicked for you.`
      : "";
  lines.push(
    `Your strongest signal is ${top.label} — ${top.items.length} related signals, total weight ${top.totalWeight.toFixed(1)}, coherence ${pct(top.confidence)}.${clickNote}`,
  );

  const secondary = rest.filter((b) => b.totalWeight >= 1).slice(0, 3);
  if (secondary.length > 0) {
    lines.push(
      `Also detected: ${secondary
        .map((b) => `${b.label} (weight ${b.totalWeight.toFixed(1)})`)
        .join(", ")}.`,
    );
  }

  const strongSkills = branches.flatMap((b) => b.skills).filter((s) => s.mastery >= 0.6);
  const formingSkills = branches.flatMap((b) => b.skills).filter((s) => s.mastery < 0.6);
  if (strongSkills.length > 0) {
    lines.push(
      `Skills holding: ${strongSkills
        .slice(0, 4)
        .map((s) => `${s.label} (${pct(s.mastery)})`)
        .join(", ")} — learned through your own interests.`,
    );
  }
  if (formingSkills.length > 0) {
    lines.push(`${formingSkills.length} more concept${formingSkills.length === 1 ? "" : "s"} still forming below 60% mastery.`);
  }

  lines.push(
    `Everything above is computed from ${stats.signals} stored signals — no profile is ever guessed, only accumulated.`,
  );

  return {
    headline: `${displayName}, Bridge currently reads you as: ${top.label}.`,
    lines,
  };
}
