# Bridge — Project Story

## Inspiration

A chemistry teacher explains ionic bonds. One student — the one who spends every evening in
ranked matches — hears nothing but noise. Tell *that* student an ionic bond works like a roster
transfer between two esports orgs, one player handed over, two teams bound by the deal, and it
clicks in a second.

Every good teacher does this. They improvise a bridge from the thing in front of them to the
thing the kid already understands. It works, and it does not scale: one teacher, thirty students,
forty-five minutes.

The mechanism has a name, and it matters that we use the right one. This is **prior-knowledge
anchoring / analogical transfer** — a real, well-supported effect. It is *not* "learning styles,"
which is discredited and appears nowhere in this project. The distinction is not pedantry: learning
styles say *change the medium for the learner*. Prior-knowledge anchoring says *change the
starting point, keep the destination identical*. Bridge does the second. Analogies are used only
to explain; every assessment stays in the subject's own vocabulary, so nobody can end up learning
the analogy instead of the chemistry.

## What it does

A learner photographs a page of their textbook. Bridge reads it, pulls out the concepts and how
they depend on each other, and works out what to study first. Separately, a short adaptive
interview builds a profile of what that person actually knows well — not from a checkbox list,
but from evidence (more on that below).

Then, for each concept, it writes an explanation through that person's own world — and
**fact-checks it against the source material before showing it.** If the check fails, it retries
with the contradiction fed back. If it fails again, the learner gets a plain, correct explanation
instead of a beautiful, wrong one.

Answers feed back: a check result moves the interest model, mastery drives an Elo estimate,
and review dates come from a spaced-repetition schedule.

## How we built it

Four stages, each its own module, each independently testable:

1. **`lib/extraction`** — vision → concept graph. Structured JSON, embedding-based dedupe, a
   prerequisite DAG, topological sort into a learning order.
2. **`lib/profile`** — the interest profile as local embedding vectors. Embeddings run
   **on-device via `@xenova/transformers`**, so there is no second API key and no second vendor
   holding a learner's interests.
3. **`lib/bridge`** — generate, then verify with an independent call that never sees the first
   answer. Verdicts are accept / revise / reject, and **every attempt is stored, including the
   rejected ones**, visible in a Verification tab.
4. **`lib/adaptive`** — Thompson sampling over interest domains, Elo for mastery, SM-2-lite for
   scheduling. Our own code, unit-tested, no library doing the thinking for us.

## Challenges we ran into

**The verifier was asking the wrong question.** This is the one worth telling. An external
fact-check of a Photosynthesis bridge found errors that our own verifier had waved through. The
cause was not a weak model — it was epistemics. The verify prompt asked *"is this covered by the
1–2 sentence definition?"* instead of *"is this true?"* Everything outside the definition was
therefore never checked, and that is exactly where the errors live. We rebuilt the judgement as
two tracks (source **and** world knowledge), added an eight-point error taxonomy and forced the
model to enumerate its absolute claims. On our test set the verifier went from catching **0 of 5**
planted errors to **5 of 5**, at 5/6 precision, with end-to-end errors per generated text falling
from **1.33 to 0.5** — and no measurable latency cost. We also tried simply using a stronger
model. It changed nothing. The question was the bug.

**The chain was hardened everywhere except at its root.** We verified every analogy against the
definition — while the definition itself came from a model reading a photograph, and was taken on
trust. A misread definition passed every later gate: the verifier correctly confirms the analogy
matches the definition it was handed, and the learner then studies something the material never
said. Concepts are now checked against their own stored transcription.

**A model's own arithmetic was believed.** Numeric practice problems came back with the problem
*and* its answer, and that answer was simply trusted. When the model miscalculated, a correct
learner was marked wrong, their mastery moved down, and a confident worked solution was shown to
justify it. That is the worst failure an assessment app has — not a weak explanation, but being
confidently wrong *about the learner*. Every numeric problem is now solved a second time by an
independent call, and survives only if both agree.

**Self-reported depth is worthless.** Asking "how well do you know cars?" gets you politeness, not
information. So the interview ends with a word magnet: real domain terms from three difficulty
tiers, mixed with plausible decoys. Which is which never leaves the server. Tapping everything to
look knowledgeable only makes your own explanations worse — and the interview says so out loud,
which is what makes the answer honest.

## Accomplishments that we're proud of

**It rejects its own analogies, in public.** The Verification tab shows a bridge for "ionic bond"
being rejected because it described electron *sharing* — that's a covalent bond — then corrected
and accepted. We kept the failures visible instead of shipping only the wins.

**Honesty as a design rule.** Similarity scores are shown as raw cosine values even when they are
unflatteringly low. The profile screen shows only what was actually inferred, and can be
contradicted by the learner. The teacher view receives aggregates only, and withholds any row with
fewer than three answers.

**It is genuinely built, not staged.** 192 tests on the demo, 215 on the product server, ten fully
translated languages, a working cache that takes a repeat explanation from 7.7 s to 13 ms, and a
1.5 MB native Android client.

## What we learned

A verifier is worth exactly as much as the question you ask it. Ours ran, returned confident
verdicts, and checked the wrong thing — which is more dangerous than no verifier at all, because
it produced a green light. We would now write the epistemic frame of a check before writing the
check.

And: reach for the prompt before reaching for a bigger model. The one measurable jump in quality
we got this month came from rewording a question, not from spending more per call.

## What's next for Bridge

A real classroom trial — everything above is measured on small, hand-built samples, and we would
rather say that plainly than round it up. Beyond that: the teacher and class model, the native
Android app out of sideloading and into the Play Store, and multilingual embeddings in production
(they work locally; switching the model without re-embedding would silently break matching, so it
is a deliberate two-step).

Open and honest: the misconception lists the model generates are unverified and used only as
hints, existing concepts still need a backfill, and the whole thing currently runs on a personal
API key with a daily budget cap.
