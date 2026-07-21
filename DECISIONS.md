# Decisions

A short log of design and technical decisions, with reasons. Open questions from
the build prompt are resolved here.

## Day 1

**LLM provider: OpenRouter, not the Anthropic SDK.**
The prompt specifies `@anthropic-ai/sdk`. We route through OpenRouter (OpenAI-compatible)
instead, because the available budget is a shared OpenRouter credit pool. The access
layer (`lib/llm/client.ts`) is provider-agnostic: one `baseURL` + model id change swaps it
back to Anthropic or any other provider. All calls still return schema-validated JSON.

**Model: `google/gemini-2.0-flash-001` (configurable via `OPENROUTER_MODEL`).**
Vision-capable (needed for Stage-1 photo scans), emits clean JSON, and is cheap
(~$0.10/M input, ~$0.40/M output) so a ~$10 budget lasts months of hackathon use.
Model id is an env var, so switching costs nothing.

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

## Open / deferred

- PWA icon is a single SVG (`purpose: any maskable`). Rasterized PNG fallbacks can be added later.
- Vision input path is wired in the API (`images[]`) but the camera UI + client downscale land in Day 2.
