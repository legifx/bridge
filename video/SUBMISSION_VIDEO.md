# Bridge — 2-minute submission video

Judging is 4×25: **Educational Impact · Creative Use of AI/ML · Technical Execution · Pitch/Demo**.
There is no live demo and no Q&A, so anything that earns points has to be *visible* in these 120
seconds. That is why this is a screen recording of the real app, not a motion-graphics reel.

- **Narration:** English, your own voice.
- **On screen:** the app in **German** — it doubles as proof of the ten-language support without
  costing a single word of narration.
- **Recording:** your phone, portrait, screen recording. Final video is 16:9; the portrait
  recording sits in a phone frame with callouts beside it (assembled here in Remotion).

---

## Before you press record

1. **Phone on the tailnet**, open `http://100.100.196.29:8330` (the local instance — no AI budget
   chip on screen, no rate limits, and I control the data).
2. **Sign in as `Mara`** — a seeded profile, no password. Language: Deutsch (Einstellungen → Sprache).
3. **Do Not Disturb on**, brightness up, battery over 50 %, notifications off.
4. **Have a real page of study material ready** to photograph (a printed page or text on a second
   screen — it must be genuine, the whole point is that it is *your* material).
5. Record **one take per shot**, not one long take. A mistake then costs one shot, not the film.
6. Record the **voice separately** (voice memo, close to your mouth, quiet room), one take per
   beat. It cuts far better and you can redo a line without refilming.

---

## The script (≈250 words, ~130 wpm — leaves breathing room)

### Beat 1 — the problem · 0:00–0:12
> "Every classroom gives thirty students the same explanation. The ones it happens to fit, get it.
> The rest are told to read it again. Bridge starts somewhere else."

**Shot:** the concept map, scrolling slowly. Subjects → folders → concepts with their mastery rings.

### Beat 2 — the profile is verified · 0:12–0:26
> "It asks what you already understand deeply — and it does not take your word for it. This grid
> holds real insider terms from your world, and invented ones. What you recognise is your verified
> depth."

**Shot:** the onboarding word magnet. To get there on a throwaway profile: sign out → sign in with
a new name + password → two interests (e.g. `Klettern`, `Kochen`) → tap through the drill questions
quickly (any answers) → the word grid is the next screen. Film the grid and a few taps on it.

### Beat 3 — your own material · 0:26–0:48
> "Photograph a page of your own textbook. A vision model reads it into a concept graph:
> definitions, what depends on what, and the order to learn it in. This is not a stock lesson —
> it is your material."

**Shot:** Aufnehmen → camera → photograph the page → the thinking loader narrating the pipeline →
the extracted concept list appearing. Keep the loader in: it shows the real stages, not a spinner.

### Beat 4 — the same concept, two learners · 0:48–1:18 *(the strongest 30 seconds)*
> "Now the same concept, for two learners. Mara plays competitive games. Theo rides horses. An
> atom's nucleus becomes a team's core for one, and the lead mare for the other. Same physics, same
> assessment — two different bridges into it. And the match is not a guess: it is cosine similarity
> between the concept and what you already know."

**Shot:** open `/compare` (link at the bottom of the sign-in screen, or type the URL). The
at-a-glance strip shows both learners side by side; then scroll into the full panels with the
bridge visualisation and the similarity number.

### Beat 5 — it checks itself · 1:18–1:40
> "An analogy that sounds good can still be wrong. So a second, independent model checks every
> explanation against the source before you ever see it. Here are three attempts it rejected, and
> why. Bridge logs its own failures — that is the difference between a demo and a tool."

**Shot:** the Verifikation tab. Scroll to the three rejected *Atom* attempts and hold on the
reasons long enough to read one.

### Beat 6 — it holds you to the subject · 1:40–1:56
> "The check stays in your subject's own language, so you cannot answer with the analogy. The score
> is a real grade in your country's system. And what works feeds back: interests grow stronger, and
> each concept returns right before you would forget it."

**Shot:** Check → answer a question → the result card with the grade and the points → quick cut to
the Brain tab (memory map) and the Wiederholen log.

### Beat 7 — close · 1:56–2:00
> "Bridge. Learn through what you already know. Everything you just saw is open source."

**Shot:** back to the concept map, hold. (Repo URL and title card are added here in post.)

---

## What to send me afterwards

- the screen recordings (one file per shot is ideal),
- the voice recordings,
- and tell me if any line changed while speaking — the burned-in subtitles must match your audio
  word for word.

I assemble it in Remotion: title card, phone frame, callouts, subtitles, outro with the repo link,
rendered 1920×1080 (musl compositor — see DECISIONS).

---

## Deliberate choices

**Screen recording, not animation.** The rubric scores Pitch/**Demo**, and with no live demo the
judges' only evidence that this works is seeing it work.

**The rejected attempts are in the film on purpose.** Every submission claims its AI is accurate.
Showing the failures it caught, with reasons, is a claim the others cannot copy cheaply.

**German UI, English narration.** Ten languages is a real feature; showing it costs no screen time
and no words.

**No "learning styles".** The idea is prior-knowledge anchoring / analogical transfer. Learning
styles are discredited and must not appear anywhere in the film or the description.
