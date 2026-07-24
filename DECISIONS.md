# Decisions

A short log of design and technical decisions, with reasons. Open questions from
the build prompt are resolved here.

## Day 1

**LLM provider: OpenRouter, not the Anthropic SDK.**
The prompt specifies `@anthropic-ai/sdk`. We route through OpenRouter (OpenAI-compatible)
instead, because the available budget is a shared OpenRouter credit pool. The access
layer (`lib/llm/client.ts`) is provider-agnostic: one `baseURL` + model id change swaps it
back to Anthropic or any other provider. All calls still return schema-validated JSON.

**Model: `google/gemma-4-31b-it:free` by default (configurable via `OPENROUTER_MODEL`).**
Chosen over the paid default after comparing current options: it is **free**, vision-capable
(needed for Stage-1 photo scans), does native function calling / JSON, has a 262K context, and
— crucially for an education app — is Apache-2.0 with **no "we train on your free inputs"** clause,
unlike some other free models (e.g. poolside/laguna free explicitly trains on free-tier inputs).
That keeps the §7 privacy story intact. Free tier has rate limits (~20/min); the documented paid
fallback `google/gemini-3.1-flash-lite` (~$0.25/$1.50 per MTok) is a one-line swap if they bite.
Model id is an env var, so switching costs nothing. Vision is a hard requirement — this ruled out
coding-specialized models like poolside/laguna (text-only).

**Next.js 16, not 15.** `create-next-app@latest` ships Next 16 + Tailwind v4 + React 19.
16 is the current default and there was no reason to pin backwards. App Router, strict TS,
Tailwind v4 tokens — all as specified.

**Prisma 6, not 7.** Prisma 7 removed `url` from the datasource block and requires a
driver-adapter + `prisma.config.ts`. That adds setup friction and breaks the promise that
`npx prisma migrate dev` just works from a fresh clone. Pinned `prisma@6` / `@prisma/client@6`.

**Project lives on the ext4 root disk, not the exFAT SSD.**
exFAT has no symlinks / no `chmod +x` / 1 MB clusters, which breaks `node_modules` and the
Next build. (Server-specific constraint.)

**Embeddings are split into two files.** `lib/ml/vector.ts` holds the pure math
(cosine, (de)serialize) with zero dependencies; `lib/ml/embeddings.ts` wraps
`@xenova/transformers`. This keeps unit tests from loading the 90 MB transformers stack.

**Concept embeddings are stored on the `Concept` row** (a `Bytes?` column not listed in the
prompt's §4 sketch). Stage 3 matches an interest domain to a concept by cosine similarity, so
the concept vector must persist. Additive and cheap.

**`NODE_ENV=production` is set globally on this machine**, which makes `npm install` skip
devDependencies. Local installs of dev tooling use `NODE_ENV=development npm install --include=dev`.
Does not affect a normal clone on a normal machine.

**DEMO_MODE from day one.** `lib/demo/cache.ts` serves cached AI responses keyed by a stable
`demoKey`, so the whole flow runs with no API key. Real embedding + dedupe + graph math still
run on the cached concepts, so the demo exercises genuine code, not a mock.

## Stages 2–4, screens, demo

**Thompson sampling needs a Beta sampler**, which needs a Gamma sampler. Implemented
Marsaglia-Tsang Gamma + Box-Muller normal over an injectable seeded RNG (`mulberry32`), so
the bandit is deterministic under test. No stats dependency.

**Elo is symmetric (both ratings move).** We persist only the learner's ability on
`Concept.elo`; the concept's difficulty rating is derived from its 1–5 `difficulty` tag via
`difficultyToElo`. The unit test checks the symmetric zero-sum update directly.

**SM-2 repetitions aren't stored** (the schema has `easeFactor`/`interval` but no `repetitions`).
We reconstruct repetitions from the stored interval (0→0, 1→1, 6→2, else→3). Good enough for a
lite scheduler and keeps the schema at §4.

**Interest match = cosine + bandit, and the cosine is honestly small.** For maximally different
domains (chemistry vs esports) the semantic overlap between a concept and an interest anchor is
genuinely near-zero. We show the real cosine rather than a flattering number — and that is the
point: naive embedding/RAG can't bridge distant domains, which is *why* the product needs a
generate→verify pipeline plus a bandit, not similarity alone.

**DEMO bridge fixtures are keyed by concept-label slug, not DB id**, so the hand-written
reject→accept pair for "Ionic bond" survives re-seeding (cuids change every seed). Concepts with
no fixture get a deterministic, on-topic templated bridge so the demo is always truthful.

**Seed runs the real pipeline in forced DEMO_MODE** (`prisma db seed` via `tsx`). It wipes and
recreates its own demo rows — two learners, one chem chapter each, pre-generated bridges, and a
handful of graded reviews so the teacher aggregate and mastery colors have data.

**Concept map is a prerequisite-ordered vertical timeline**, not a 2-D force graph — it reads
cleanly on a 390px viewport and films well, which is what the rubric rewards.

## Second brain & skill tree

**The brain is a table, not a service.** `BrainItem` is a per-learner vector store in the same
SQLite file: kind (interest/anchor/signal), label, text, embedding, weight. No extra infra, no
second database — "simple installation from the repo" stays true.

**Maturing = merge-and-strengthen, not re-training.** A new signal within cosine ≥ 0.92 of an
existing item adds its weight to that item instead of inserting. Repeated evidence accumulates
into heavy items; noise stays light. This is transparent and inspectable — you can read the
brain row by row.

**Feedback signals derive their vector from stored vectors.** A "that clicked" event embeds as
the 2:1 weighted average of the domain and concept vectors we already have — no model call, so
the brain keeps growing even on serverless hosts where the local model is disabled.

**The tree is computed on read.** Greedy weighted clustering (heaviest first, cosine ≥ 0.55 to a
weight-weighted, re-normalized centroid) over the stored vectors, at request time. No cluster
table to migrate or drift; the tree always reflects the current brain. Unit-tested in
tests/braincluster.test.ts.

**The summary is templated, not LLM prose.** Every sentence cites a weight, a Beta posterior, or
a mastery score. For a feature whose pitch is "see what the algorithm thinks", generated prose
would undermine the point; traceable numbers are the feature.

**Skills hang off the branch that actually bridged them.** A concept attaches to the cluster of
the domain whose accepted bridge taught it — not by raw cosine (chemistry terms are semantically
far from hobby terms; that low cosine is honest and expected).

## Onboarding v3 — the adaptive interview

**Why the fixed form had to go.** v2 offered 20 hard-coded options; whoever didn't fit them got
bridges through a stranger's world, and the casual/into/deep calibration was pure self-report —
claimed confidence, not earned. v3 inverts the flow: the learner's own seeds first, then the
interview adapts to them.

**Server-driven interactions.** The API returns typed `Interaction` objects (this-or-that,
slider, sub-options, word magnet) and the client renders per kind — the LLM output is fenced by
Zod at every step, and interview knowledge (tiers, decoys) never leaves the server, so the
"quiz" cannot be read out of devtools.

**The word magnet is the verification.** ~12 real terms across three tiers plus 3 invented
decoys; one tap-through yields (a) the anchors exactly as the bridge engine consumes them,
(b) a verified depth tier from the tier distribution, (c) a larping check — decoy hits demote
depth and collapse evidence multiplicatively. Depth never gates a domain; it selects the
vocabulary register the bridges may use (`DEPTH_REGISTER` in the generate prompt). A casual car
fan gets brakes-and-fuel analogies, not gear-ratio jargon — which is also what keeps the verify
loop's acceptance rate honest.

**Quiz items go through generate→verify too.** An independent audit call reviews the generated
magnets (fake decoys that turn out real, wrong-tier terms) — the same pattern that guards the
bridges guards the interview. Preference cascade per domain: audited set → curated fixture →
unaudited set → unverified default; a failed model call degrades the interview, never kills it.

**Evidence seeds the bandit warm.** `depthToProfile` maps (depth, evidence) onto starting
confidence (capped at 0.9 — total certainty from a 3-minute interview would be a lie), a warm
Thompson prior (verified-deep starts at α=5), and second-brain weights. Unverified domains
start light (evidence 0.25) and must mature through clicked bridges, exactly like v1 signals.

**Provenance is logged like the bridges are.** Every served interaction and every answer is
appended to `OnboardingSession.log` — how a profile came to be is inspectable, in the same
spirit as the verification log. Re-running onboarding updates same-name domains and never
deletes rows (bridges/reviews hang off them); the mirror screen's explicit "×" is the only
destructive correction, scoped to that domain and its seeded brain items.

## Open / deferred

- PWA icon is a single SVG (`purpose: any maskable`). Rasterized PNG fallbacks can be added later.
- Vision input path is wired in the API (`images[]`) but the camera UI + client downscale land in Day 2.

## Learning experience v2 (2026-07-24, user feedback rounds)

**Grading is points-based and teacher-style, not binary.** Each check question is worth points
(free 3, mcq 2, problems numeric 3 / mcq 2 / open 4). Free-recall and open problems earn PARTIAL
credit (a 0..1 score × points); mcq/numeric are all-or-nothing. The headline result is the check
SCORE = earned/total, coherent with performance — the Elo mastery moves continuously
(`updateEloScore`) and is shown secondary. Grading judges MEANING, never wording: an answer
phrased differently but correct in substance gets full marks.

**Interactive learning, not just text.** After the analogy, the agent picks 1–2 of five safe,
schema-bounded widget types (scale / steps / barChart / diagram / formula) that fit the concept;
the formula widget is a slider→live-result interactive backed by a hand-written safe expression
evaluator (no eval). Widget contents pass an independent fact-check, same guardrail as bridges.

**Real practice problems.** Checks include solvable problems (numeric checked with tolerance, mcq
deterministic, open LLM-graded against a model solution). A "practice tasks" mode gives a bigger
problem set from the review log; "relearn" rebuilds the explanation targeting last time's mistakes.

**Quota is per learning aspect, not per request.** The first billable request for a concept spends
one unit and marks it paid; all further work on that concept is free — a learner can't get
stranded mid-aspect. Capture and onboarding are free. Owner code = unlimited.

**Capture is fast: right model per modality + deferred embeddings.** Text/PDF/DOCX use the fast
text model (~1.5s), images use the vision/OCR model. Concept embeddings are computed lazily at
first-learn (stored then), not at capture, so uploads don't pay the local model's load time.

**Grades in the learner's country system.** Scores render as the country grade (Germany 1–6, USA
A–F, France 0–20, …, or percentage) via `lib/grades.ts`, chosen in the Settings tab (which also
holds the language picker). Internal score/Elo is unchanged — a pure display transform in the LED
readout (font extended with A–F + comma).

**Speak your answer.** Free-text and open answers can be dictated via the browser's speech
recognition; the transcript is graded exactly like typed text.

**Brain tab leads with a memory map.** A radial, tap-interactive graph (`BrainGraph`) — a 'You'
core with interests sized by weight, tap to fan out the skills learned through each — is the first
thing on the Brain tab, understandable without any technical background. The weights, coherence,
posteriors and cluster tree stay below for the curious.

## Review pass (2026-07-24)

**The session cookie is signed, not just secret.** It carried a bare learner id, so the account
password only held as long as nobody learned an id — anyone who did could set the cookie by hand
and walk straight in. It is now `<id>.<hmac>` under `AUTH_SECRET`. Without the env var the app
still accepts plain ids, because a fresh clone has to run with nothing but a database URL; with
it, forging a session needs the secret. Turning it on signs everyone out once, which is the
correct trade.

**Public pages read the seeded profiles by name, not "the two oldest rows".** `/api/compare` is
unauthenticated. It picked the first two learners by `createdAt`, which happened to be the seeds
here — on a fresh database it would have published two real people's names and study material.

**Every AI call has a deadline, and the bridge loop has a budget.** A bridge is up to three
generate/verify pairs plus two widget calls, all sequential. One quiet upstream used to hang the
whole request until the platform killed it (no message, no explanation, quota already spent).
Now: a per-call timeout (45s, 180s for multi-page vision), a wall-clock budget in the engine that
stops retrying and ships the plain explanation while there is still time to send it, a widget step
that skips itself when the budget is gone, and `maxDuration` on every AI route. 60s is used
because it is the ceiling every Vercel plan allows.

**Errors are logged, not echoed.** Routes returned raw exception text to the browser, including
setup hints like "OPENROUTER_API_KEY is not set". `lib/api/errors.ts` logs the real error and
answers with a localized sentence that says what to do next (rate-limited / too slow / try again),
keeping the detail only in development.

**Finalizing an interview is exactly-once.** A double-submitted last answer built the profile
twice and counted every interest signal twice. The session is now claimed with a conditional
update before the expensive step, and handed back if it fails.

**The offline grader speaks more than ASCII.** The fallback used when a grading call fails
stripped every non-`[a-z0-9]` character, so a German, Ukrainian, Turkish or Arabic answer had all
its words deleted and scored 0 by construction — in an app that ships in ten languages.

**The review log shows the grade of that check.** It showed long-term mastery, which is a
different (and usually smaller) number than what the learner just scored — the exact confusion the
points-based grading rework was meant to end. The check's own earned/total was already stored;
it is now what the row displays, with mastery beside it in the detail view.

**React 19 purity.** State written during effects, a counter mutated mid-render, `Date.now()` in
render bodies. `ThinkingLoader` also depended on its `stages` array identity, so an inline array
from the parent restarted the timer on every render and the narration could sit on stage one
forever. Time is now read through a minute-bucketed external store, and browser capabilities
(speech recognition, reduced motion, stored language) through `useSyncExternalStore` instead of
being mirrored into state from an effect.
