/**
 * "What the algorithm thinks you're into" — a deliberately transparent,
 * numbers-backed summary generated from the tree itself. No LLM: every claim
 * is traceable to a weight, a posterior, or a mastery score, which fits the
 * product's honesty ethos (and costs nothing, everywhere, in every mode).
 * Templates live in the i18n dictionaries, so the summary follows the
 * learner's main language.
 */
import { st } from "@/lib/i18n";
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

export function summarizeBrain(
  tree: BrainTree,
  displayName: string,
  language?: string,
): BrainSummary {
  const { branches, stats } = tree;
  const L = language;

  if (branches.length === 0) {
    return {
      headline: st(L, "sum.emptyHeadline"),
      prose: st(L, "sum.emptyProse"),
      lines: [st(L, "sum.emptyLine")],
    };
  }

  const [top, ...rest] = branches;
  const totalW = branches.reduce((s, b) => s + b.totalWeight, 0) || 1;
  const share = (b: (typeof branches)[number]) => Math.round((b.totalWeight / totalW) * 100);

  // The human read: what you're into, in plain words.
  const sentences: string[] = [];
  const secondaries = rest.filter((b) => b.totalWeight >= 1).slice(0, 2);
  if (secondaries.length === 0) {
    sentences.push(st(L, "sum.allAbout", { top: top.label }));
  } else {
    sentences.push(
      st(L, "sum.mostly", {
        top: top.label,
        topPct: share(top),
        others: secondaries.map((b) => `${b.label} (${share(b)}%)`).join(st(L, "sum.and")),
      }),
    );
  }
  if (top.successRate !== null && top.successRate > 0.55) {
    sentences.push(st(L, "sum.lands", { top: top.label }));
  }
  const skillCount = branches.reduce((s, b) => s + b.skills.length, 0);
  if (skillCount > 0) {
    sentences.push(
      skillCount === 1 ? st(L, "sum.oneStuck") : st(L, "sum.manyStuck", { n: skillCount }),
    );
  }
  const prose = sentences.slice(0, 3).join(" ");

  const lines: string[] = [];

  const clickNote =
    top.successRate !== null ? st(L, "sum.clickNote", { p: pct(top.successRate) }) : "";
  lines.push(
    st(L, "sum.strongest", {
      top: top.label,
      items: top.items.length,
      weight: top.totalWeight.toFixed(1),
      coh: pct(top.confidence),
      click: clickNote,
    }),
  );

  const secondary = rest.filter((b) => b.totalWeight >= 1).slice(0, 3);
  if (secondary.length > 0) {
    lines.push(
      st(L, "sum.also", {
        list: secondary
          .map((b) => `${b.label} (${st(L, "sum.weight", { w: b.totalWeight.toFixed(1) })})`)
          .join(", "),
      }),
    );
  }

  const strongSkills = branches.flatMap((b) => b.skills).filter((s) => s.mastery >= 0.6);
  const formingSkills = branches.flatMap((b) => b.skills).filter((s) => s.mastery < 0.6);
  if (strongSkills.length > 0) {
    lines.push(
      st(L, "sum.holding", {
        list: strongSkills
          .slice(0, 4)
          .map((s) => `${s.label} (${pct(s.mastery)})`)
          .join(", "),
      }),
    );
  }
  if (formingSkills.length > 0) {
    lines.push(
      formingSkills.length === 1
        ? st(L, "sum.formingOne")
        : st(L, "sum.formingMany", { n: formingSkills.length }),
    );
  }

  lines.push(st(L, "sum.computed", { n: stats.signals }));

  return {
    headline: st(L, "sum.headline", { name: displayName, top: top.label }),
    prose,
    lines,
  };
}
