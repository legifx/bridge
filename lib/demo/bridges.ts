/**
 * Hand-written seed fixtures for the showcase concept "Ionic bond",
 * bridged through two maximally different worlds. Each has a FLAWED first
 * attempt (a1) that the verifier rejects for a real factual reason, then a
 * corrected attempt (a2) it accepts. This drives the reject -> accept beat in
 * the seeded profiles without an API key.
 *
 * Used by prisma/seed.ts so the seeded profiles ship a real rejected->accepted
 * pair without spending any API budget.
 * Keys: bridge:<conceptSlug>:<domainSlug>:a<n> and verify:<...>:a<n>.
 */
import type { BridgeBody, Verdict } from "@/lib/bridge/types";

const accept: Verdict = { factuallyConsistent: true, contradictions: [], analogyOverreach: false, verdict: "accept" };

// --- Ionic bond x competitive gaming ---
const gamingA1: BridgeBody = {
  opening: "Think of an ionic bond like two teammates sharing their resources equally in a match.",
  correspondences: [
    { subject: "electrons", yourWorld: "shared resources", explanation: "both players pool and share the electrons equally" },
    { subject: "the bond", yourWorld: "team composition", explanation: "the shared pool holds the team together" },
  ],
  breaksDown: "Even best friends sometimes disagree.",
  plainRestatement: "An ionic bond is when two atoms share electrons equally.",
};
const gamingRejectA1: Verdict = {
  factuallyConsistent: false,
  contradictions: [
    { claim: "two atoms share electrons equally", reason: "That describes a COVALENT bond. In an ionic bond electrons are transferred, not shared — one atom gives them up and the other takes them." },
  ],
  analogyOverreach: true,
  verdict: "reject",
};
const gamingA2: BridgeBody = {
  opening: "An ionic bond is like a roster transfer between two esports orgs: one player is transferred out, and the two teams are now bound by that deal.",
  correspondences: [
    { subject: "electron transfer", yourWorld: "a completed roster transfer", explanation: "one atom gives up valence electrons the way an org transfers a player out — the move is total, not shared" },
    { subject: "cation and anion", yourWorld: "the two orgs after the deal", explanation: "the selling org ends up 'positive' (gave up a player) and the buying org 'negative' (gained one); they are now opposite parties" },
    { subject: "electrostatic attraction", yourWorld: "the binding contract", explanation: "the opposite positions pull the two together, just as the signed deal ties the orgs" },
  ],
  breaksDown: "A transfer is negotiated; an ionic bond is forced by electronegativity. And the pull here is pure electrostatic attraction, nothing contractual.",
  plainRestatement: "An ionic bond is the electrostatic attraction between two oppositely charged ions formed when one atom transfers valence electrons to another.",
};

// --- Ionic bond x horse riding ---
const horseA1: BridgeBody = {
  opening: "An ionic bond is like a horse and rider sharing the reins equally between them.",
  correspondences: [
    { subject: "electrons", yourWorld: "the reins", explanation: "horse and rider hold the reins together, sharing them" },
    { subject: "the bond", yourWorld: "sharing tack", explanation: "shared equipment keeps them connected" },
  ],
  breaksDown: "Sometimes the horse ignores the rider.",
  plainRestatement: "An ionic bond is two atoms sharing electrons like shared reins.",
};
const horseRejectA1: Verdict = {
  factuallyConsistent: false,
  contradictions: [
    { claim: "two atoms sharing electrons", reason: "Ionic bonding is electron TRANSFER, not sharing. Shared electrons describe covalent bonds. One atom must fully give electrons to the other." },
  ],
  analogyOverreach: true,
  verdict: "reject",
};
const horseA2: BridgeBody = {
  opening: "Picture the pecking order at the feed trough: one horse gives up its spot, and that very difference is what binds the pair in the herd.",
  correspondences: [
    { subject: "electron transfer", yourWorld: "giving up the spot at the trough", explanation: "one atom fully hands over valence electrons the way a horse yields its place — it is given up, not shared" },
    { subject: "cation and anion", yourWorld: "the higher- and lower-ranked horse", explanation: "the one that gave up becomes 'positive', the one that took becomes 'negative' — two opposite roles" },
    { subject: "electrostatic attraction", yourWorld: "the pecking-order bond", explanation: "those opposite ranks are exactly what holds the pair together in the herd" },
  ],
  breaksDown: "Herd rank shifts over time and is a choice of temperament; an ionic bond is fixed by electronegativity and is purely an electrical attraction.",
  plainRestatement: "An ionic bond is the electrostatic attraction between two oppositely charged ions formed when one atom transfers valence electrons to another.",
};

export const BRIDGE_FIXTURES: Record<string, unknown> = {
  "bridge:ionic-bond:competitive-gaming:a1": gamingA1,
  "verify:ionic-bond:competitive-gaming:a1": gamingRejectA1,
  "bridge:ionic-bond:competitive-gaming:a2": gamingA2,
  "verify:ionic-bond:competitive-gaming:a2": accept,

  "bridge:ionic-bond:horse-riding:a1": horseA1,
  "verify:ionic-bond:horse-riding:a1": horseRejectA1,
  "bridge:ionic-bond:horse-riding:a2": horseA2,
  "verify:ionic-bond:horse-riding:a2": accept,
};
