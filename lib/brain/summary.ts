/**
 * "What the algorithm thinks you're into" — a deliberately transparent,
 * numbers-backed summary generated from the tree itself. No LLM: every claim
 * is traceable to a weight, a posterior, or a mastery score, which fits the
 * product's honesty ethos (and costs nothing, everywhere, in every mode).
 */
import type { BrainTree } from "./tree";

export type BrainSummary = {
  headline: string;
  /** 1-3 plain sentences, no jargon — the primary thing a learner reads. */
  prose: string;
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
      prose:
        "Bridge hasn't learned anything about you yet. Do the onboarding or learn a concept — the picture builds itself from there.",
      lines: [
        "Answer the onboarding taps or learn a concept — every signal lands here and the picture sharpens as you go.",
      ],
    };
  }

  const [top, ...rest] = branches;
  const totalW = branches.reduce((s, b) => s + b.totalWeight, 0) || 1;
  const share = (b: (typeof branches)[number]) => Math.round((b.totalWeight / totalW) * 100);

  // The human read: what you're into, in plain words.
  const sentences: string[] = [];
  const secondaries = rest.filter((b) => b.totalWeight >= 1).slice(0, 2);
  if (secondaries.length === 0) {
    sentences.push(`Right now it's really all about ${top.label} for you — pretty much everything Bridge knows about you points there.`);
  } else {
    sentences.push(
      `You're mostly about ${top.label} (${share(top)}%), with ${secondaries
        .map((b) => `${b.label} (${share(b)}%)`)
        .join(" and ")} alongside.`,
    );
  }
  if (top.successRate !== null && top.successRate > 0.55) {
    sentences.push(`Explanations through ${top.label} genuinely land for you — most of them clicked.`);
  }
  const skillCount = branches.reduce((s, b) => s + b.skills.length, 0);
  if (skillCount > 0) {
    sentences.push(
      `${skillCount === 1 ? "One concept has" : skillCount + " concepts have"} already stuck by riding on your own interests.`,
    );
  }
  const prose = sentences.slice(0, 3).join(" ");

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
    prose,
    lines,
  };
}
