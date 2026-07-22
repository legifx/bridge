import { prisma } from "@/lib/db/prisma";
import { buildProfileV2 } from "@/lib/profile/build2";
import { planInterview, generateMagnets, synthesizeDomains } from "./generate";
import { scoreMagnet, syncScore, shuffle, UNVERIFIED, MAX_STEPS } from "./score";
import type {
  Answer,
  DomainState,
  Interaction,
  InterviewState,
  MirrorDomain,
} from "./types";

/**
 * The interview state machine: seed -> drill -> verify -> mirror.
 *
 * The server owns all interview knowledge (which words are decoys, which tier
 * a term belongs to); the client only ever receives renderable Interaction
 * objects and posts Answer objects back. Every served step and every answer
 * is appended to the session log — a profile's provenance stays inspectable.
 */

export type StepBatch = {
  sessionId: string;
  phase: "drill" | "verify" | "mirror";
  steps: Interaction[];
  sync: number;
  profile?: MirrorDomain[];
};

const DRILL_CAP = 10; // magnets (<= 4) + drill (<= 10) stay within MAX_STEPS
const norm = (s: string) => s.trim().toLowerCase();

function slugify(name: string, index: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s ? `${s}-${index}` : `domain-${index}`;
}

/** Attach the seeds that plausibly fed a domain (provenance only). */
function matchSeeds(name: string, seeds: string[]): string[] {
  return seeds.filter((s) => norm(name).includes(norm(s)) || norm(s).includes(norm(name)));
}

function buildDrillSteps(
  domains: DomainState[],
  plan: Awaited<ReturnType<typeof planInterview>>,
): Interaction[] {
  const steps: Interaction[] = [];
  const sliders: Interaction[] = [];
  plan.domains.forEach((p, i) => {
    const d = domains[i];
    if (p.roleQuestion) {
      steps.push({
        kind: "thisorthat",
        id: `${d.key}|role`,
        domain: d.name,
        prompt: p.roleQuestion.prompt,
        left: p.roleQuestion.left,
        right: p.roleQuestion.right,
      });
    }
    if (p.subQuestion) {
      steps.push({
        kind: "suboptions",
        id: `${d.key}|sub`,
        domain: d.name,
        prompt: p.subQuestion.prompt,
        options: p.subQuestion.options,
      });
    }
    if (p.slider) {
      sliders.push({
        kind: "slider",
        id: `${d.key}|slider`,
        domain: d.name,
        prompt: p.slider.prompt,
        leftLabel: p.slider.leftLabel,
        rightLabel: p.slider.rightLabel,
      });
    }
  });
  // Sliders are the most droppable question type — trim them first.
  return [...steps, ...sliders.slice(0, Math.max(0, DRILL_CAP - steps.length))].slice(0, DRILL_CAP);
}

/** Generate word magnets, store them (shuffled) in the state, return the steps. */
async function buildVerifySteps(domains: DomainState[], language?: string): Promise<Interaction[]> {
  const magnets = await generateMagnets(domains, language);
  const steps: Interaction[] = [];
  for (const d of domains) {
    const words = magnets.get(d.key);
    if (!words) continue; // unverifiable domain — stays at the unverified default
    const shuffled = shuffle(words);
    d.magnet = { words: shuffled };
    steps.push({
      kind: "wordmagnet",
      id: `${d.key}|magnet`,
      domain: d.name,
      prompt: "Tap every word you actually know and use. Skip anything unfamiliar — honesty tunes your bridges.",
      words: shuffled.map((w) => w.term),
    });
  }
  return steps;
}

async function finalize(learnerId: string, state: InterviewState, language?: string): Promise<MirrorDomain[]> {
  for (const d of state.domains) {
    if (d.magnet?.picked) {
      const s = scoreMagnet(d.magnet.words, d.magnet.picked);
      d.depth = s.depth;
      d.evidence = s.evidence;
      d.anchors = s.realPicks;
    } else {
      d.depth = UNVERIFIED.depth;
      d.evidence = UNVERIFIED.evidence;
      d.anchors = d.facets?.slice(0, 4) ?? [];
    }
  }
  const synth = await synthesizeDomains(state.domains, language);
  const seen = new Set<string>();
  const inputs = state.domains.map((d, i) => {
    const anchors = [...(d.anchors ?? []), ...synth[i].extraAnchors]
      .filter((a) => {
        const k = norm(a);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8);
    seen.clear();
    return {
      name: synth[i].name || d.name,
      tagline: synth[i].tagline,
      anchors,
      depth: d.depth ?? "hobbyist",
      evidence: d.evidence ?? 0,
      role: d.role,
    };
  });
  return buildProfileV2(learnerId, inputs);
}

type LogEntry = { t: string; at?: string } & Record<string, unknown>;

function appendLog(logJson: string, entry: LogEntry): string {
  let log: LogEntry[] = [];
  try {
    log = JSON.parse(logJson);
  } catch {
    /* start fresh */
  }
  log.push({ ...entry, at: new Date().toISOString() });
  return JSON.stringify(log);
}

export async function startInterview(learnerId: string, seeds: string[], language?: string): Promise<StepBatch> {
  const plan = await planInterview(seeds, language);
  const domains: DomainState[] = plan.domains.map((p, i) => ({
    key: slugify(p.name, i),
    name: p.name,
    seeds: matchSeeds(p.name, seeds),
  }));

  let phase: StepBatch["phase"] = "drill";
  let steps = buildDrillSteps(domains, plan);
  if (steps.length === 0) {
    steps = await buildVerifySteps(domains, language);
    phase = "verify";
  }

  const state: InterviewState = { domains, served: steps.length, pending: steps.map((s) => s.id) };
  let profile: MirrorDomain[] | undefined;
  if (steps.length === 0) {
    // Nothing to ask at all (rare) — build the best profile we can and mirror it.
    profile = await finalize(learnerId, state, language);
    phase = "mirror";
  }

  const session = await prisma.onboardingSession.create({
    data: {
      learnerId,
      phase,
      status: phase === "mirror" ? "done" : "active",
      state: JSON.stringify(state),
      log: appendLog(appendLog("[]", { t: "seeds", seeds }), { t: "served", steps }),
    },
  });

  return { sessionId: session.id, phase, steps, sync: syncScore(domains), profile };
}

function applyAnswer(state: InterviewState, a: Answer): void {
  if (!state.pending.includes(a.id)) return; // unknown or already answered
  const [key, slot] = a.id.split("|");
  const d = state.domains.find((x) => x.key === key);
  if (!d) return;
  if (a.kind === "thisorthat" && slot === "role") d.role = a.value;
  else if (a.kind === "slider" && slot === "slider") d.handsOn = a.value;
  else if (a.kind === "suboptions" && slot === "sub") d.facets = a.values.slice(0, 8);
  else if (a.kind === "wordmagnet" && slot === "magnet" && d.magnet) {
    // Only terms that were actually served count — nothing can be injected.
    d.magnet.picked = a.picked.filter((p) => d.magnet!.words.some((w) => norm(w.term) === norm(p)));
  } else return;
  state.pending = state.pending.filter((id) => id !== a.id);
}

export async function continueInterview(
  learnerId: string,
  sessionId: string,
  answers: Answer[],
  language?: string,
): Promise<StepBatch> {
  const session = await prisma.onboardingSession.findFirst({
    where: { id: sessionId, learnerId },
  });
  if (!session) throw new Error("Interview session not found.");
  if (session.status !== "active") throw new Error("This interview is already finished.");

  const state: InterviewState = JSON.parse(session.state);
  for (const a of answers) applyAnswer(state, a);
  let log = appendLog(session.log, { t: "answers", answers });

  let phase = session.phase as StepBatch["phase"];
  let steps: Interaction[] = [];
  let profile: MirrorDomain[] | undefined;
  let status = session.status;

  if (state.pending.length === 0) {
    if (phase === "drill") {
      steps = (await buildVerifySteps(state.domains, language)).slice(0, MAX_STEPS - state.served);
      if (steps.length > 0) {
        phase = "verify";
        state.served += steps.length;
        state.pending = steps.map((s) => s.id);
        log = appendLog(log, { t: "served", steps });
      }
    }
    if (steps.length === 0) {
      profile = await finalize(learnerId, state, language);
      phase = "mirror";
      status = "done";
      log = appendLog(log, { t: "profile", profile });
    }
  }

  await prisma.onboardingSession.update({
    where: { id: session.id },
    data: { phase, status, state: JSON.stringify(state), log },
  });

  return { sessionId: session.id, phase, steps, sync: syncScore(state.domains), profile };
}
