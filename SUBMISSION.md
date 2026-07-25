# Bridge — submission text

Ready to paste into Devpost. Judging is 4×25: Educational Impact, Creative Use of AI/ML,
Technical Execution, Pitch/Demo. The video carries the last one; this text carries the rest for
judges who read before they watch.

---

## Tagline

Learn new material through what you already understand deeply.

## Inspiration

A classroom gives thirty students one explanation. It lands for the few whose existing knowledge
it happens to touch; everyone else is told to read it again, slower. But the student who can
explain a competitive game's team composition in detail, or how a herd sorts out its hierarchy,
already has the structure a chemistry chapter is asking for — nobody ever connects the two.

That connection is called prior-knowledge anchoring, or analogical transfer, and it is one of the
better-supported ideas in learning science. (It is emphatically *not* "learning styles", which is
discredited and appears nowhere in this project.) It is also exactly the kind of work a language
model can do at scale and a teacher with thirty students cannot: build a different bridge into the
same concept for every learner in the room.

## What it does

**It builds a profile of what you already know — and verifies it.** Onboarding is an adaptive
interview, not a form. You name a few interests; the app generates a word grid mixing real insider
terms from those worlds with invented decoys, and what you recognise sets your verified depth.
Claiming to be deep into something does not make you deep into it.

**It reads your own material.** Photograph a textbook page, or drop in a PDF or DOCX. A vision
model transcribes it and extracts a concept graph: definitions, the quote each definition came
from, prerequisites, and a learning order. Near-duplicate concepts are merged by embedding
similarity, and the prerequisite edges are topologically sorted, so you get a path rather than a
pile.

**It explains each concept through your world.** The engine matches the concept to an interest by
cosine similarity, then generates an analogy carried through at least two structural
correspondences — including where the analogy breaks down, which is stated rather than hidden.
Where it fits, the agent adds an interactive widget: a scale, a process, a chart, a diagram, or a
formula with sliders you can move.

**It checks itself before you see it.** Every explanation is verified by a second, independent
model call against the source definition: factually consistent, no analogy overreach, and
appropriate for a school audience. A failed verdict feeds the contradictions back and the engine
tries again — up to three attempts, then a different interest, then a plain non-analogical
explanation rather than a pretty wrong one. Every attempt, accepted or rejected, is logged and
readable in the app.

**It assesses in the subject's language.** The check asks you to recall the concept in the
subject's own vocabulary, so you cannot answer with the analogy — the bridge is for understanding,
not for the exam. Grading is points-based with partial credit and judges meaning over wording, and
the score renders in your country's grade system.

**It adapts.** A Thompson-sampled bandit learns which of your interests actually work for you, Elo
tracks mastery per concept as a continuous quantity, and SM-2 schedules the next review. All three
are our own code, unit-tested, not library calls.

## How we built it

Next.js 16 (App Router, TypeScript strict), Tailwind v4, SQLite via Prisma — one file locally,
hosted SQLite (Turso) in production, identical schema and queries either way.

Four AI/ML stages:

1. **Extraction** — vision or text model → concept graph as validated JSON; embedding dedupe at
   cosine ≥ 0.86; prerequisite DAG with topological sort.
2. **Profile** — the interview's verified depth and recognised anchors become an interest vector
   store, with a warm Thompson prior derived from the evidence.
3. **Bridge** — generate → independently verify → accept, revise or reject; every attempt
   persisted.
4. **Adaptive** — Thompson (which interest to use), Elo (mastery), SM-2 (when to return).

Embeddings run **locally** via `@xenova/transformers` (all-MiniLM-L6-v2) — no second API key, no
per-token cost, and the vectors never leave the machine. Every model call returns schema-validated
JSON; we never parse prose.

## Challenges we ran into

**The verifier only helps if it is genuinely independent.** Our first version showed the model its
own analogy along with the framing that produced it, and it approved nearly everything. It judges
the explanation against the source definition alone now, and it rejects real work — the log in the
app shows three consecutive rejections for one atom analogy, with reasons.

**Latency is a pedagogical problem, not just a technical one.** A learner staring at a loader
stops learning. We measured the model options rather than guessing: the highest-scoring model
needed ~20s per call, which made the interview take three minutes. We picked a model that answers
in ~1.5s at equal quality for our prompts, split the widget generation out of the explanation
request (text at 3.7s instead of 6.7s), and cache what a returning visit needs so re-opening a
concept is a 9ms database read instead of a regeneration.

**A content-security policy fought the framework.** Moving to a nonce-based CSP silently broke
the sign-in page: statically prerendered pages cannot carry a per-request nonce, so all 16 of its
scripts would have been blocked in the browser. We found it by counting nonce-less script tags
across every route before shipping, and made rendering dynamic.

**Ten languages break assumptions you did not know you had.** The offline grading fallback
stripped every non-ASCII character, so a German or Ukrainian answer scored zero by construction.
The privacy guard that refuses sensitive personal disclosures was English-only — it protected
exactly the learners who happen to type in English.

## Accomplishments we're proud of

The app logs its own failures. The verification view exists to show explanations the system threw
away, which is the opposite of how AI demos usually present themselves — and it is the only claim
here a competitor cannot copy by writing a better prompt.

Also: no scores were ever faked. Every number on screen — cosine similarity, mastery, bandit
confidence, the next review date — is computed by our code from real data, and each is inspectable
in the interface.

## What we learned

Verification is worth more than a better prompt. A model asked to be careful is still guessing; a
second model asked to check a specific claim against a specific source catches things the first
one was fluent about. And the cost is bounded — one extra call per attempt, with a hard retry
limit and a plain-explanation fallback.

## What's next

A multilingual embedding model (the current one is English-trained, which quietly disadvantages
interests described in the other nine languages), the cohort view for teachers, and offline
support for the PWA.
