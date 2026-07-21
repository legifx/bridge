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

## Open / deferred

- PWA icon is a single SVG (`purpose: any maskable`). Rasterized PNG fallbacks can be added later.
- Vision input path is wired in the API (`images[]`) but the camera UI + client downscale land in Day 2.
