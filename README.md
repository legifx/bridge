# Bridge

**Learn new material through the knowledge you already hold.**

**▶ Live demo: https://bridge-livid-one.vercel.app** — the real app, live. Sign in with any
name (or open the lived-in profiles `Mara` / `Theo`), run onboarding with your own interests,
capture material, and watch bridges get fact-checked in real time. Every demo profile carries a
small AI budget so the shared API key survives; accounts are open by design — please don't
enter private data.

Bridge builds an **interest and prior-knowledge profile** of a learner, then re-expresses
curriculum concepts through a domain that learner already understands deeply. The same
chemistry chapter is explained to a competitive-gaming student and to a horse-riding student
through *their* world — while the facts, the vocabulary being learned, and every assessment
stay identical. New knowledge sticks when it attaches to knowledge that is already firmly held;
Bridge builds that attachment automatically.

This is **prior-knowledge anchoring / analogical transfer**, a real and well-supported effect —
not "learning styles," which is discredited. Analogies are used only for *explanation*; all
*assessment* is in the subject's own vocabulary, so a student can never end up learning the
analogy instead of the subject.

---

## The four AI/ML stages

```mermaid
flowchart LR
    A[Photo / text<br/>study material] -->|Stage 1<br/>lib/extraction| B[Concept graph<br/>dedupe + DAG + topo sort]
    P[5 taps + 1 free text] -->|Stage 2<br/>lib/profile| Q[Interest profile<br/>local embedding vectors]
    B --> C
    Q --> C
    C[Stage 3 · lib/bridge<br/>generate then verify] -->|accept / revise / reject| D[Bridge explanation<br/>+ where it breaks down]
    D -->|clicked? / quiz| E[Stage 4 · lib/adaptive<br/>Thompson · Elo · SM-2]
    E -->|updates| Q
    E -->|schedules| B
```

1. **`lib/extraction` — Vision → Concept Graph.** The model returns structured concepts
   (label, definition, verbatim source quote, difficulty, prerequisites). *Our own code* then
   embeds them locally, merges near-duplicates by cosine similarity, builds the prerequisite
   DAG, detects cycles, and topologically sorts them into a learning order.
2. **`lib/profile` + `lib/onboarding` — Interest profile via adaptive interview.** Onboarding is
   a server-driven interview, not a form: free seeds (plus a discovery grid) → LLM-generated
   drill questions (this-or-that, sliders, sub-areas) → a **word magnet** per domain that mixes
   real terms in three tiers with plausible decoys. What the learner actually recognizes
   determines a *verified* vocabulary depth (`novice/hobbyist/deep`), the evidence behind it,
   and the anchors — so confidence is **earned, not self-reported**, larping collapses on the
   decoys, and the bridge engine later speaks in the register the learner verifiably owns. The
   generated quiz items pass the same generate→verify pattern as the bridges. The result is a
   **vector store** of interest domains (local embeddings), not a prompt string; a final
   mirror screen shows what was understood, with honest confidence, and is correctable.
3. **`lib/bridge` — Bridge engine + verification loop.** One call generates the analogical
   explanation; a second, independent call fact-checks it against the source quote and returns a
   verdict. On `revise`/`reject` it retries with the contradictions fed back, then falls back to a
   plain explanation rather than shipping something wrong. **Every attempt, including rejected
   ones, is logged.**
4. **`lib/adaptive` — the real ML, our own code.** Thompson sampling picks which interest domain
   to use; Elo tracks per-concept mastery; SM-2-lite schedules review.
5. **`lib/brain` — a second brain per learner.** Every signal (onboarding taps, free-text
   interests, every *"that clicked"*) lands in a per-learner vector store (`BrainItem`). A signal
   whose embedding is within cosine ≥ 0.92 of an existing item **strengthens that item's weight**
   instead of inserting — repeated signals mature into strong interests. The **Brain tab** renders
   this store as a skill tree: greedy weighted clustering over the stored vectors (our own code,
   unit-tested), interest branches sized by weight, learned concepts hanging off the branch whose
   domain actually bridged them, plus a transparent summary of what the algorithm currently
   thinks you're into — every claim backed by a weight, a posterior, or a mastery score. No LLM
   involved; it works read-only, everywhere.

### Formulas (implemented in `lib/adaptive`, unit-tested)

**Thompson sampling (domain selection).** Each interest domain holds a Beta(α, β) posterior over
"did this analogy work?". To choose, sample `θ_d ~ Beta(α_d, β_d)` for each domain and pick the max.
After feedback: `α ← α + 1` on *clicked*, `β ← β + 1` on *didn't land*.

**Elo (per-concept mastery).** Learner ability `R_L` and concept difficulty `R_C` update after each
answer with expected score `E = 1 / (1 + 10^((R_C − R_L)/400))` and
`R_L ← R_L + K·(S − E)`, where `S = 1` if correct else `0` (`K ≈ 24`).

**SM-2-lite (spaced repetition).** On a correct review, `interval` grows
`1 → 6 → interval·easeFactor` days; the ease factor adjusts by recall quality
`EF ← max(1.3, EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02)))`; a miss resets the interval to 1.

> Status: all four stages are built and working end to end, with the full learner flow
> (onboarding → capture → concept map → learn session → retrieval check), a verification log,
> an aggregate-only teacher view, a split-screen profile comparison, and seeded demo data.

---

## Run it (4 commands from a fresh clone)

```bash
cp .env.example .env      # add your OpenRouter key for live AI
npm install
npx prisma migrate dev
npm run dev
```

Then seed two demo learners (competitive gaming vs horse riding) with pre-generated bridges:

```bash
npm run db:seed
```

Open http://localhost:3000 and sign in with any name. The seeded profiles `Mara` and `Theo`
are fully explorable without an API key (pre-generated bridges, brains, mastery data) — the
embedding, dedupe, graph, Thompson, Elo, SM-2 and brain-clustering math all run for real. Live
AI (capturing your own material, generating fresh bridges, quizzes) needs `OPENROUTER_API_KEY`
in `.env`. Provider is OpenRouter; the default model is the **free**, vision-capable
`google/gemma-4-31b-it:free` (Apache-2.0, not trained on your inputs), with automatic fallback
to `google/gemini-3.1-flash-lite` when the free tier is rate-limited.

```bash
npm test                  # unit tests: dedupe, cycle detection, Thompson, Elo, SM-2
```

## Privacy

A learner is a local profile — no accounts, no email. Learner data, including the second brain,
stays in the local database and is never shared between learners. The teacher view receives
**aggregates only**: concept-level counts, never individuals, never interest profiles. Onboarding
asks only about interests — never family, emotions, or health.

## Stack

Next.js 16 (App Router, TS strict) · Tailwind v4 · SQLite + Prisma 6 · OpenRouter (structured JSON)
· local `@xenova/transformers` embeddings (`all-MiniLM-L6-v2`) · PWA (installable).

## Deploy

Two supported targets, same codebase:

- **Persistent host (Railway / Fly.io / your own box)** — SQLite on a persistent volume, the
  full app with no demo restrictions.
- **Vercel (public demo)** — the [live demo](https://bridge-livid-one.vercel.app). On Vercel the
  app enters public-demo mode automatically: open username sign-in, a small AI budget per
  profile (default 10 units: capture = 2, bridge/quiz/grading = 1 each), and the "no private
  data" notice. The embedding model runs inside the function (linux-x64 ONNX only, cache in
  `/tmp`). Set `OPENROUTER_API_KEY` in the Vercel project for live AI, and point
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` at a (free-tier) Turso database so profiles persist —
  Turso is hosted SQLite, so the schema and every query stay identical. Without Turso the app
  falls back to an ephemeral `/tmp` copy of the seeded DB (fine for kicking the tires, but
  sign-ins don't survive instance recycling). Apply the schema once with
  `node scripts/migrate-remote.mjs`, seed with `npx prisma db seed` (both honor the Turso env
  vars).

  `GET /api/me` reports which datasource is live and whether it is reachable (never the secrets
  themselves), which makes a misconfigured deployment diagnosable from outside.

## What's not built yet (honest status)

- **Live vision** is wired end to end (camera + client downscale + `images[]` API), but the
  bundled demo data is text-sourced; scanning a real handwritten page needs a live API key.
- The concept map is a linear, prerequisite-ordered timeline rather than a free-form 2-D graph.
- SM-2 scheduling stores state per review but there is no "due today" review queue screen yet.
- No PNG icon rasterization (the PWA ships a single maskable SVG icon).

See [`DECISIONS.md`](./DECISIONS.md) for the reasoning behind each technical choice.

MIT licensed.
