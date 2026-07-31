# Bridge — Project Story

## Inspiration

A chemistry teacher explains ionic bonds. One student — the one who spends every evening in
ranked matches — hears nothing but noise. Tell *that* student an ionic bond works like a roster
transfer between two esports orgs, one player handed over, two teams bound by the deal, and it
clicks in a second.

Every good teacher does this — improvises a bridge from the thing in front of them to the thing
the kid already understands. It works, and it does not scale: one teacher, thirty students,
forty-five minutes.

The mechanism has a name, and using the right one matters. This is **prior-knowledge anchoring /
analogical transfer**, an effect with real support in the learning-science literature. It is *not*
"learning styles," which has repeatedly failed to replicate and appears nowhere in this project.
The difference is not pedantry: learning styles say *change the medium for the learner*.
Prior-knowledge anchoring says *change the starting point, keep the destination identical*. Bridge
does the second.

## What it does

A learner photographs a page of their textbook. Bridge pulls out the concepts and how they depend
on each other, and works out what to study first. Separately, a short adaptive interview builds a
profile of what that person actually knows well — from evidence, not a checkbox list. Then, for
each concept, it writes an explanation through that person's own world and **fact-checks it
against the source material before showing it.** If the check fails it retries with the
contradiction fed back; if it fails again, the learner gets a plain, correct explanation instead
of a beautiful, wrong one.

### The teaching decisions, not just the engineering ones

Most of the hard calls in this project were pedagogical:

- **Analogies explain; they never assess.** Every quiz question stays in the subject's own
  vocabulary. A student who learned "roster transfer" still has to answer about ions — so nobody
  can pass by mastering the analogy instead of the chemistry. This is the guardrail the whole idea
  stands or falls on.
- **The explanation names where the analogy breaks.** Each bridge ends with the point at which the
  comparison stops holding. An analogy taken too far becomes a misconception, and the cheapest
  place to stop that is inside the explanation itself.
- **Nothing is taught before its prerequisites.** The concept graph is a DAG; a learner standing
  on ground they have not covered is told so, and pointed at it first.
- **Known misconceptions travel with each concept** and are handed to both the generator and the
  checker, so an analogy cannot quietly teach the standard wrong idea.
- **Reading level is adjustable** and steers every later explanation — "too easy" and "too hard"
  are the most common feedback a learner has.
- **Teachers see aggregates only**, and any row with fewer than three answers is withheld. A tool
  that turns into per-student surveillance stops being used honestly by students.

## How we built it

Four stages, each its own module, each independently testable:

1. **`lib/extraction`** — vision → concept graph. Structured JSON, embedding-based dedupe, a
   prerequisite DAG, topological sort into a learning order.
2. **`lib/profile`** — the interest profile as embedding vectors computed **on-device**
   (`@xenova/transformers`), so there is no second API key and no second vendor holding a
   learner's interests.
3. **`lib/bridge`** — generate, then verify with an independent call that never sees the first
   answer. Verdicts are accept / revise / reject, and **every attempt is stored, including the
   rejected ones**, visible in a Verification tab.
4. **`lib/adaptive`** — Thompson sampling over interest domains, Elo for mastery, SM-2-lite for
   scheduling. Our own code, unit-tested.

Three front ends share those modules: the **open demo** (no sign-up), an **account-based server**
adding logins and quotas, and a **native Android client** talking to that server.

## Challenges we ran into

**The verifier was asking the wrong question.** A fact-check run by a different model, outside our
own pipeline, found errors in a photosynthesis bridge that our verifier had waved through. The
cause was not a weak model — it was epistemics. The prompt asked *"is this covered by the 1–2
sentence definition?"* instead of *"is this true?"* A definition is one or two sentences; an
analogy necessarily says more, so roughly everything the learner actually read went unchecked —
and that is exactly where the errors live. We rebuilt the judgement as two tracks (source **and**
world knowledge), added an eight-point error taxonomy, and forced the model to enumerate its
absolute claims.

Three separate measurements, all small (n = 5–6), so treat them as a direction and not as a
result:

- Against the text that started this: the old prompt caught **0 of 5** planted false claims, the
  new one **5 of 5**.
- Recall and precision, with a correct control text included: from **0/6 recall at 6/6 precision**
  — it accepted everything, which makes a checker worthless — to **6/6 recall at 5/6 precision**.
- End to end, through the real generate → verify → retry loop and scored by a different, larger
  model: factual errors per delivered text fell from **1.33 to 0.5**, and wall-clock actually
  dropped slightly (4.08 s → 3.76 s), because the fix adds no extra call.

We also swapped in a stronger model. No improvement, higher cost. The question was the bug.

**The chain was hardened everywhere except at its root.** We checked every analogy against the
definition — while the definition itself came from a model reading a photograph and was taken on
trust, so a misread one passed every later gate. Concepts are now checked against their own stored
transcription.

**A model's own arithmetic was believed.** Numeric problems arrived with the answer attached, and
it was trusted — so a miscalculation marked a *correct* learner wrong and moved their mastery
down. Each one is now solved again by an independent call and kept only if both agree.

**Self-reported depth is worthless.** "How well do you know cars?" gets politeness, not
information. The interview ends with a word magnet instead: real domain terms across three
difficulty tiers, mixed with plausible decoys, and which is which never leaves the server.

## Accomplishments that we're proud of

**It rejects its own analogies, in public.** The Verification tab shows a bridge for "ionic bond"
rejected because it described electron *sharing* — that's a covalent bond — then corrected and
accepted. We kept the failures visible instead of shipping only the wins.

**Honesty as a design rule.** Similarity scores appear as raw cosine values even when they are
unflatteringly low. The profile screen shows only what was actually inferred, and the learner can
delete any part of it.

**It is genuinely built, not staged.** 192 tests on the demo and 215 on the account-based server;
a render cache that takes a repeat explanation from 7.7 s to 13 ms; and a native Android client
that is 1.5 MB because the UI is Compose and the artwork is drawn in code rather than bundled.
The interface ships in ten languages — 320 strings each, with completeness enforced by the type
system, though the translations themselves are model-produced and not yet reviewed by speakers.

## What we learned

A verifier is worth exactly as much as the question you ask it. Ours ran, returned confident
verdicts, and checked the wrong thing — which is more dangerous than no verifier at all, because
it produced a green light. We would now write the epistemic frame of a check before writing the
check. And: reach for the prompt before reaching for a bigger model.

## What's next for Bridge

**A classroom trial, because that is the evidence we do not have.** Everything above measures
whether the system is *correct*, not whether it *teaches better* — that needs learners, a control
condition and a retention check. We would rather name the gap than round it up.

Beyond that: the teacher and class model, the Android app out of sideloading and into the Play
Store, and multilingual embeddings in production. Open and honest: the generated misconception
lists are unverified and used only as hints, older concepts still need a backfill, and the whole
thing currently runs on a personal API key with a daily budget cap.
