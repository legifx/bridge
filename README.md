# Bridge

**Learn new material through the knowledge you already hold.**

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
2. **`lib/profile` — Interest profile.** A short tap-based onboarding produces a **vector store**
   of interest domains (local embeddings), not a prompt string. Matching an interest to a concept
   is cosine similarity, shown in the UI.
3. **`lib/bridge` — Bridge engine + verification loop.** One call generates the analogical
   explanation; a second, independent call fact-checks it against the source quote and returns a
   verdict. On `revise`/`reject` it retries with the contradictions fed back, then falls back to a
   plain explanation rather than shipping something wrong. **Every attempt, including rejected
   ones, is logged.**
4. **`lib/adaptive` — the real ML, our own code.** Thompson sampling picks which interest domain
   to use; Elo tracks per-concept mastery; SM-2-lite schedules review.

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

> Status: Stage 1 is built and working end to end. Stages 2–4 are next (see build order). The
> formulas above are the specification these modules implement.

---

## Run it (4 commands from a fresh clone)

```bash
cp .env.example .env      # works as-is: DEMO_MODE=true, no API key needed
npm install
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000, paste study material (or tap **Use demo chapter**), and watch the
concept graph assemble. With `DEMO_MODE=true` the AI responses are cached — the full flow runs
with no key — while the embedding, dedupe, and graph math run for real.

To use live AI: set `OPENROUTER_API_KEY` in `.env` and `DEMO_MODE=false`.
(Provider is OpenRouter; model via `OPENROUTER_MODEL`, default `google/gemini-2.0-flash-001`.)

```bash
npm test                  # unit tests for the core graph / ML algorithms
```

## Privacy

A learner is a local profile — no accounts, no email. Learner data stays in the local database
and is never shared between learners. The (upcoming) teacher view receives **aggregates only**:
concept-level counts, never individuals, never interest profiles. Onboarding asks only about
interests — never family, emotions, or health.

## Stack

Next.js 16 (App Router, TS strict) · Tailwind v4 · SQLite + Prisma 6 · OpenRouter (structured JSON)
· local `@xenova/transformers` embeddings (`all-MiniLM-L6-v2`) · PWA (installable).

## What's not built yet (honest status)

- Stages 2–4 (interest profile, bridge engine + verification log, adaptive loop).
- Camera capture + client-side image downscale (the API already accepts images).
- Concept-map visualization, learn session, teacher view, seeded two-profile demo.

See [`DECISIONS.md`](./DECISIONS.md) for the reasoning behind each technical choice.

MIT licensed.
