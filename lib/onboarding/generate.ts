import { llmJson } from "@/lib/llm/client";
import { checkInterestText } from "@/lib/profile/guard";
import {
  PLAN_SYSTEM,
  MAGNET_SYSTEM,
  MAGNET_AUDIT_SYSTEM,
  SYNTH_SYSTEM,
} from "@/lib/prompts/onboarding";
import {
  PlanSchema,
  MagnetGenSchema,
  MagnetAuditSchema,
  SynthesisSchema,
  type Plan,
  type MagnetWord,
  type DomainState,
  type Synthesis,
} from "./types";
import { sanitizeMagnet, MAX_DOMAINS } from "./score";
import { findFixtureMagnet, fallbackRoleQuestion, fallbackSlider } from "./fixtures";

/**
 * The three interview generators. Every one of them degrades gracefully:
 * a failed LLM call falls back to heuristics/curated fixtures, so the
 * onboarding NEVER hard-fails because of the model.
 */

const norm = (s: string) => s.trim().toLowerCase();

/** Drop generated questions/names that trip the privacy guard (§7). */
function guardedPlan(plan: Plan): Plan {
  const domains = plan.domains
    .filter((d) => checkInterestText(d.name).ok)
    .map((d) => ({
      ...d,
      roleQuestion: d.roleQuestion && checkInterestText(d.roleQuestion.prompt).ok ? d.roleQuestion : null,
      slider: d.slider && checkInterestText(d.slider.prompt).ok ? d.slider : null,
      subQuestion: d.subQuestion && checkInterestText(d.subQuestion.prompt).ok ? d.subQuestion : null,
    }));
  return { domains };
}

function heuristicPlan(seeds: string[]): Plan {
  const seen = new Set<string>();
  const unique = seeds.filter((s) => {
    const k = norm(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    domains: unique.slice(0, MAX_DOMAINS).map((seed) => ({
      name: seed.slice(0, 48),
      roleQuestion: fallbackRoleQuestion(seed),
      slider: fallbackSlider(seed),
      subQuestion: null,
    })),
  };
}

/** Call A — normalize seeds into domains + drill questions. */
export async function planInterview(seeds: string[]): Promise<Plan> {
  try {
    const plan = await llmJson({
      system: PLAN_SYSTEM,
      user: `Seeds the learner gave:\n${seeds.map((s) => `- ${s}`).join("\n")}`,
      schema: PlanSchema,
      temperature: 0.4,
    });
    const guarded = guardedPlan(plan);
    if (guarded.domains.length > 0) return guarded;
  } catch {
    // fall through to the heuristic
  }
  return heuristicPlan(seeds);
}

function domainContext(d: DomainState): string {
  const parts = [`Domain: ${d.name}`];
  if (d.role) parts.push(`role: ${d.role}`);
  if (d.facets?.length) parts.push(`sub-areas: ${d.facets.join(", ")}`);
  if (d.handsOn !== undefined) {
    parts.push(`engagement (0=casual .. 1=serious): ${d.handsOn.toFixed(2)}`);
  }
  return parts.join(" · ");
}

/** Call B + independent audit B2 — word magnets per domain, keyed by domain key. */
export async function generateMagnets(domains: DomainState[]): Promise<Map<string, MagnetWord[]>> {
  const out = new Map<string, MagnetWord[]>();
  let generated: { domain: string; words: MagnetWord[] }[] = [];
  let audited: { domain: string; words: MagnetWord[] }[] = [];

  try {
    const gen = await llmJson({
      system: MAGNET_SYSTEM,
      user: domains.map(domainContext).join("\n"),
      schema: MagnetGenSchema,
      temperature: 0.5,
    });
    generated = gen.magnets;

    // Same generate->verify pattern as the bridge engine: an independent call
    // audits the sets; unsure decoys and wrong terms get dropped.
    try {
      const audit = await llmJson({
        system: MAGNET_AUDIT_SYSTEM,
        user: generated
          .map(
            (mset) =>
              `Domain: ${mset.domain}\n${mset.words.map((w) => `- [${w.tier}] ${w.term}`).join("\n")}`,
          )
          .join("\n\n"),
        schema: MagnetAuditSchema,
        temperature: 0,
      });
      audited = generated.map((g) => {
        const a = audit.audits.find((x) => norm(x.domain) === norm(g.domain));
        if (!a) return g;
        const drop = new Set(a.drop.map(norm));
        return { ...g, words: g.words.filter((w) => !drop.has(norm(w.term))) };
      });
    } catch (err) {
      console.warn("onboarding: magnet audit failed, using unaudited sets", err);
      audited = generated;
    }
  } catch (err) {
    console.warn("onboarding: magnet generation failed, falling back to fixtures", err);
  }

  const forDomain = (sets: { domain: string; words: MagnetWord[] }[], name: string) =>
    sets.find((g) => norm(g.domain) === norm(name) || norm(g.domain).includes(norm(name)));

  for (const d of domains) {
    // Preference cascade: audited LLM set -> curated fixture -> unaudited LLM
    // set. An empty audited set usually means the audit was over-aggressive,
    // not that the domain is unverifiable — some verification beats none.
    const fixture = findFixtureMagnet(d.name);
    const candidates = [
      forDomain(audited, d.name)?.words,
      fixture ?? undefined,
      forDomain(generated, d.name)?.words,
    ];
    let words: MagnetWord[] = [];
    for (const c of candidates) {
      if (!c) continue;
      words = sanitizeMagnet(c);
      if (words.length > 0) break;
    }
    if (words.length > 0) out.set(d.key, words);
    else console.warn(`onboarding: no usable magnet for "${d.name}" — domain stays unverified`);
  }
  return out;
}

/** Call C — final naming, taglines and register-matched extra anchors. */
export async function synthesizeDomains(domains: DomainState[]): Promise<Synthesis["domains"]> {
  const fallback = domains.map((d) => ({ name: d.name, tagline: "", extraAnchors: [] as string[] }));
  try {
    const synth = await llmJson({
      system: SYNTH_SYSTEM,
      user: domains
        .map((d) => {
          const picked = d.anchors?.length ? d.anchors.join(", ") : "(none)";
          return `${domainContext(d)}\nverified depth: ${d.depth ?? "hobbyist"}\nterms they verifiably know: ${picked}\nseeds: ${d.seeds.join(", ") || "-"}`;
        })
        .join("\n\n"),
      schema: SynthesisSchema,
      temperature: 0.4,
    });
    // Outputs are ordered like the inputs; tolerate a short or reordered list.
    return domains.map((d, i) => {
      const byName = synth.domains.find((s) => norm(s.name) === norm(d.name));
      const s = byName ?? synth.domains[i];
      if (!s || !checkInterestText(s.name).ok) return fallback[i];
      return {
        name: s.name,
        tagline: checkInterestText(s.tagline).ok ? s.tagline : "",
        extraAnchors: s.extraAnchors.slice(0, 6),
      };
    });
  } catch {
    return fallback;
  }
}
