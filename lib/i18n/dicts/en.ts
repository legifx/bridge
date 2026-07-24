/**
 * English — the base dictionary. Its shape IS the schema: every other
 * language file is typed against `typeof en`, so a missing key is a compile
 * error, not a silent English fallback.
 *
 * Interpolation: `{name}` placeholders, resolved by `format()` in ../index.ts.
 */
export const en = {
  // ---- common ----
  "common.loading": "Loading…",
  "common.somethingWrong": "Something went wrong.",
  "common.tryAgain": "Try again",
  "common.back": "Back",
  "common.on": "on",
  "common.off": "off",

  // ---- nav / shell ----
  "nav.map": "Map",
  "nav.review": "Review",
  "nav.capture": "Capture",
  "nav.brain": "Brain",
  "nav.settings": "Settings",
  "nav.teacher": "Teacher",
  "nav.compare": "compare ↗",
  "shell.signOut": "Sign out",
  "shell.aiBudget": "AI actions left on this demo profile. When it's empty, sign in with another name to keep going.",
  "shell.aiEmpty": "empty",
  "shell.aiLabel": "AI",
  "shell.language": "Main language",
  "settings.eyebrow": "Settings",
  "settings.title": "Your preferences",
  "settings.sub": "Language and how your grades are shown.",
  "settings.language": "Language",
  "settings.gradeSystem": "Grades — your country",
  "settings.gradeSystemSub": "Scores are shown in this country's grading system. Your progress is stored the same either way.",
  "shell.publicDemo":
    "Public test demo · accounts are open (anyone who knows a name can open that profile) · please don't enter private data · each profile carries a small AI budget.",

  // ---- sign-in ----
  "signin.heroTitle": "Learn new things through what you already know.",
  "signin.heroSub":
    "Bridge builds an interest profile from a few taps, then re-explains any study material through your world — and fact-checks every analogy before you see it.",
  "signin.pickName": "pick a name to start",
  "signin.sessionEnded": "session ended — sign back in",
  "signin.expiredNote": "Your session ended. Enter the same name to pick up exactly where you left off.",
  "signin.placeholder": "e.g. nova, tim, käsebrot…",
  "signin.opening": "opening your profile…",
  "signin.start": "Start learning",
  "signin.existing": "Existing name? Signing in with it brings your profile right back.",
  "signin.orExplore": "or explore a lived-in profile",
  "signin.mara": "Mara · gaming",
  "signin.theo": "Theo · horses",
  "signin.footer1":
    "Public test demo — accounts are open: anyone who knows a name can open that profile. Please don't enter private or personal data. Each profile has a small AI budget.",
  "signin.footer2":
    "This demo exists so you can see how Bridge reads your interests — and tell us whether it got you right.",

  // ---- onboarding ----
  "ob.eyebrow": "Bridge · your world",
  "ob.seedTitle": "What do you care about?",
  "ob.seedSub":
    "Type your own things — that's the strongest signal — or tap around the grid. A short interview then figures out how deep each one really goes. No fixed categories, no wrong answers.",
  "ob.language": "Main language",
  "ob.languageSub":
    "Questions, explanations and feedback come in this language. You can change it any time from the header.",
  "ob.own": "Your own interests",
  "ob.ownPlaceholder": "drum & bass production, bouldering, local LLMs…",
  "ob.add": "Add",
  "ob.orExplore": "or explore",
  "ob.fbRolePrompt": "{name} — which is closer to you?",
  "ob.fbRoleLeft": "I watch / follow it",
  "ob.fbRoleRight": "I do it myself",
  "ob.fbSliderPrompt": "When you spend time on {name}, it's mostly…",
  "ob.fbSliderLeft": "relaxing / casual",
  "ob.fbSliderRight": "learning / improving",
  "ob.interviewEyebrow": "Bridge · interview",
  "ob.mirrorEyebrow": "Bridge · your brain, mirrored",
  "ob.mirrorTitle": "Here's what I understood",
  "ob.mirrorSub":
    "Every confidence below was earned in the interview, not assumed. Remove anything that feels wrong — the rest keeps calibrating as you learn.",
  "ob.notMe": "Not me — remove",
  "ob.confidence": "confidence",
  "ob.nothingLeft": "Nothing left — restart the interview to rebuild your profile.",
  "ob.startOver": "Start over",
  "ob.brainSync": "brain sync",
  "ob.readingWorld": "reading your world…",
  "ob.addOne": "Add or tap at least one thing",
  "ob.startInterview": "Start the interview ({n}) →",
  "ob.honest": "Honest answers → better bridges. There is no score.",
  "ob.looksRight": "Looks right — start learning →",
  "ob.depth.casual": "casual",
  "ob.depth.hobbyist": "hobbyist",
  "ob.depth.deep": "deep",
  // thinking stages: seed -> interview
  "ob.think1.a": "Reading your seeds",
  "ob.think1.b": "Embedding each interest",
  "ob.think1.bd": "local vectors — your words become geometry",
  "ob.think1.c": "Mapping interest domains",
  "ob.think1.d": "Drafting your interview",
  "ob.think1.dd": "questions built only from what you said",
  // thinking stages: between batches
  "ob.think2.a": "Scoring your answers",
  "ob.think2.b": "Updating each domain",
  "ob.think2.bd": "depth is verified, never self-reported",
  "ob.think2.c": "Choosing what to ask next",
  "ob.think2.d": "Calibrating confidence",
  // interview step furniture
  "steps.aboutRight": "That's about right →",
  "steps.noneContinue": "None of these — continue",
  "steps.continue": "Continue →",
  "steps.lockIn": "Lock in {n} →",
  "steps.magnetHint": "No score, no grade — unknown words are just as useful a signal as known ones.",
  // served by the server inside the interview
  "steps.magnetPrompt":
    "Tap every word you actually know and use. Skip anything unfamiliar — honesty tunes your bridges.",

  // discovery grid
  discovery: [
    { label: "Gaming", subs: ["competitive shooters", "strategy games", "Minecraft & building games", "speedrunning", "game design"] },
    { label: "Music", subs: ["playing an instrument", "music production", "DJing", "singing"] },
    { label: "Sports & fitness", subs: ["football", "basketball", "gym & lifting", "running", "skating"] },
    { label: "PC & tech", subs: ["building PCs", "AI & machine learning", "coding", "gadgets"] },
    { label: "Cars & engines", subs: ["car mechanics", "tuning", "motorsport", "motorcycles"] },
    { label: "Making & building", subs: ["woodworking", "3D printing", "LEGO & models", "electronics"] },
    { label: "Cooking & baking", subs: ["cooking", "baking bread", "coffee brewing", "street food"] },
    { label: "Animals & nature", subs: ["horses", "dogs", "fishing", "hiking & camping"] },
    { label: "Art & design", subs: ["drawing", "digital art", "photography", "fashion"] },
    { label: "Film & stories", subs: ["movies & series", "anime & manga", "books & writing"] },
    { label: "Creating online", subs: ["YouTube & streaming", "video editing", "podcasts"] },
    { label: "Science & space", subs: ["astronomy", "physics", "math puzzles"] },
  ],

  // ---- map ----
  "map.eyebrow": "Concept map",
  "map.title": "Your learning order",
  "map.due": "due for review",
  "map.folders": "{n} folder(s)",
  "map.photoCapture": "photo capture",
  "map.capture": "capture",
  "map.addMaterial": "+ add material",
  "map.otherTopics": "Other topics",
  "map.otherConcepts": "other concepts",
  "map.emptyProfileTitle": "Start with what you already know.",
  "map.emptyProfileBody":
    "A short onboarding builds your interest profile. Then every concept is re-lit through your world.",
  "map.buildProfile": "Build my profile",
  "map.emptyCaptureTitle": "Add something to learn.",
  "map.emptyCaptureBody": "Snap a page or paste text. Bridge turns it into a concept map.",
  "map.captureCta": "Capture material",

  // ---- capture ----
  "cap.eyebrow": "Capture",
  "cap.title": "Add material",
  "cap.titleInto": "Add to “{title}”",
  "cap.subNew":
    "Snap a page or paste text — in the subject's own words. Every capture becomes its own folder.",
  "cap.subInto": "New concepts land inside this folder and slot into its learning order.",
  "cap.takePhoto": "Take a photo or pick a PDF / Word file",
  "cap.retake": "Retake photo",
  "cap.fileReady": "“{name}” is ready",
  "cap.pagesPartial": "Long document: reading the first {used} of {total} pages.",
  "cap.badFile": "Couldn't read that file. Try another one.",
  "cap.badImage": "Could not read that image. Try another.",
  "cap.orPaste": "or paste",
  "cap.pastePlaceholder": "Paste a paragraph from your notes…",
  "cap.useDemo": "use demo chapter ↗",
  "cap.build": "Build concept map",
  "cap.addToFolder": "Add to folder",
  "cap.working": "reading · extracting · linking…",
  "cap.think.a": "Reading the page",
  "cap.think.b": "Extracting atomic concepts",
  "cap.think.bd": "definitions stay faithful to your source",
  "cap.think.c": "Embedding & de-duplicating",
  "cap.think.d": "Linking prerequisites",
  "cap.think.dd": "sparse, correct edges — your learning order",

  // ---- learn ----
  "learn.loading": "Loading concept…",
  "learn.concept": "concept",
  "learn.explain": "Explain through my world",
  "learn.relearnNote": "Re-explained to target what tripped you up last time.",
  "learn.building": "building a bridge to your world…",
  "learn.preparing": "Preparing the material",
  "learn.preparingDetail": "analyzing this aspect for the first time",
  "learn.couldNotBuild": "Could not build a bridge.",
  "learn.attempt": "attempt {n} · rejected",
  "learn.factChecker": "↳ the fact-checker caught it — revised until accurate",
  "learn.breaksDown": "where this analogy breaks down",
  "learn.plainNoAnalogy": "plain explanation · no analogy passed the fact-check",
  "learn.plainTerms": "in plain subject terms",
  "learn.clicked": "That clicked",
  "learn.didntLand": "Didn't land",
  "learn.notedLean": "Noted — we'll lean on this domain more.",
  "learn.notedDifferent": "Noted — we'll try a different domain next time.",
  "learn.check": "Check what stuck →",
  "learn.explainedVia": "Explained through",
  "learn.orVia": "try another interest",

  // ---- check ----
  "check.eyebrow": "Check · from memory",
  "check.sub":
    "Answered in the subject's own words — the explanation stays behind on purpose. Recalling it yourself is what makes it stick.",
  "check.couldNotLoad": "Could not load the check.",
  "check.writing": "writing your questions…",
  "check.generating": "generating from the source, not the analogy",
  "check.freePlaceholder": "From memory, in your own words…",
  "check.speak": "Speak your answer",
  "check.grading": "grading your recall…",
  "check.submit": "Submit answers",
  "check.points": "pts",
  "check.masteryLabel": "Mastery",
  "check.task": "Task",
  "check.recallLabel": "Free recall",
  "check.yourAnswer": "Your answer",
  "check.solution": "Solution",
  "check.taskRight": "correct",
  "check.taskWrong": "not yet",
  "check.gotIt": "Got it.",
  "check.notQuite": "Not quite — worth another pass.",
  "check.mastery": "mastery · next review {d}d",
  "check.keepRotation": "↻ Keep this in review rotation",
  "check.srsNote": "Spaced repetition: Bridge resurfaces this concept right before you'd forget it.",
  "check.backToMap": "Back to map",

  // ---- review ----
  "review.eyebrow": "Spaced repetition",
  "review.logTitle": "Your learning log",
  "review.logSub": "Everything you've studied — tap one to see your score and redo it.",
  "review.dueNote": "{n} due for review — tap to redo.",
  "review.emptyLog": "Nothing yet. Learn a concept and it shows up here.",
  "review.yesterday": "yesterday",
  "review.daysAgo": "{n} days ago",
  "review.multipleChoice": "Multiple choice",
  "review.noDetail": "No breakdown saved for this one.",
  "review.relearnBtn": "Relearn",
  "review.tasksBtn": "Practice tasks",
  "review.title": "Review queue · {n} due",
  "review.caughtUp": "All caught up",
  "review.next": "Next review {when}.",
  "review.enableNote":
    "Enable spaced repetition on any concept after your first check to keep it in rotation.",
  "review.due": "due",
  "review.concepts": "· {n} concept(s)",
  "review.upcoming": "upcoming ({n})",
  "review.notInRotation": "not in rotation ({n}) — complete a check to add",
  "review.startLearning": "learn →",
  "review.overdue": "overdue",
  "review.today": "today",
  "review.tomorrow": "tomorrow",
  "review.inDays": "in {n} days",

  // ---- brain ----
  "brain.eyebrow": "Second brain",
  "brain.title": "What Bridge thinks you're into",
  "brain.sub":
    "A per-learner vector store that grows with every signal. Clusters, weights and posteriors are shown as they are — nothing is guessed.",
  "brain.whatThinks": "what bridge thinks",
  "brain.numbers": "the numbers",
  "brain.legendToggle": "What do these numbers mean?",
  "brain.legWeight": "Weight: how strong an interest is — it grows with every signal.",
  "brain.legCoherence": "Coherence: how tightly an interest's signals fit together semantically.",
  "brain.legClicked": "Clicked: how often explanations through this interest landed for you.",
  "brain.legMastery": "Mastery: how confidently you know a concept learned through it.",
  "brain.signals": "signals",
  "brain.branches": "branches",
  "brain.skills": "skills",
  "brain.noSignals": "No signals yet. Build a profile and learn something — the tree grows on its own.",
  "brain.buildProfile": "Build my profile",
  "brain.wt": "wt",
  "brain.coherence": "coherence {p}%",
  "brain.clicked": " · {p}% clicked",
  "brain.skillsVia": "skills via this interest",

  // ---- verification ----
  "verif.eyebrow": "Verification",
  "verif.title": "Every bridge, fact-checked",
  "verif.sub":
    "A second, independent model checks each analogy against the source. Accepted and rejected attempts are both kept — honesty is the point.",
  "verif.none": "No bridges yet. Learn a concept and its attempts show up here.",
  "verif.via": "via {domain}",
  "verif.plain": "plain",
  "verif.accepted": "accepted",
  "verif.rejected": "rejected",

  // ---- teacher ----
  "teach.eyebrow": "Teacher",
  "teach.title": "Where the cohort struggles",
  "teach.privacyBold": "Bridge profiles material, not children.",
  "teach.privacyRest":
    " Concept-level counts only — no student names, no individuals, and never anyone's interests.",
  "teach.none": "No cohort activity yet. Once learners answer checks, hardest concepts rank here.",
  "teach.concept": "Concept",
  "teach.att": "Att",
  "teach.struggle": "Struggle",
  "teach.mastered": "Mastered",

  // ---- compare ----
  "cmp.eyebrow": "Same concept · two worlds",
  "cmp.title": "One idea, two ways",
  "cmp.noBridge": "No pre-generated bridge for this profile yet.",
  "cmp.footer":
    "Same facts, same concept, same assessment — only the explanation is re-lit through each learner's world.",

  // ---- brain summary (server-templated) ----
  "sum.emptyHeadline": "Nothing recorded yet.",
  "sum.emptyProse":
    "Bridge hasn't learned anything about you yet. Do the onboarding or learn a concept — the picture builds itself from there.",
  "sum.emptyLine":
    "Answer the onboarding taps or learn a concept — every signal lands here and the picture sharpens as you go.",
  "sum.allAbout":
    "Right now it's really all about {top} for you — pretty much everything Bridge knows about you points there.",
  "sum.mostly": "You're mostly about {top} ({topPct}%), with {others} alongside.",
  "sum.and": " and ",
  "sum.lands": "Explanations through {top} genuinely land for you — most of them clicked.",
  "sum.oneStuck": "One concept has already stuck by riding on your own interests.",
  "sum.manyStuck": "{n} concepts have already stuck by riding on your own interests.",
  "sum.strongest":
    "Your strongest signal is {top} — {items} related signals, total weight {weight}, coherence {coh}.{click}",
  "sum.clickNote": " When Bridge explains things through it, {p} of those bridges clicked for you.",
  "sum.also": "Also detected: {list}.",
  "sum.weight": "weight {w}",
  "sum.holding": "Skills holding: {list} — learned through your own interests.",
  "sum.formingOne": "1 more concept still forming below 60% mastery.",
  "sum.formingMany": "{n} more concepts still forming below 60% mastery.",
  "sum.computed":
    "Everything above is computed from {n} stored signals — no profile is ever guessed, only accumulated.",
  "sum.headline": "{name}, Bridge currently reads you as: {top}.",

  // ---- late additions: viz label, server-side errors, engine fallbacks ----
  "viz.overlap": "semantic overlap · cosine",
  "widget.nextStep": "Next step",
  "widget.replay": "Replay",
  "cap.extractFailed": "Extraction failed.",
  "err.quota":
    "Demo budget used up for this profile. Sign in with a different name to keep exploring — or clone the repo and run Bridge with your own key.",
  "err.embeddings":
    "Onboarding needs the local embedding model, which this hosted demo does not ship. Clone the repo and run Bridge locally to build a profile.",
  "engine.plainOpening": "Here is {label} in plain terms, without an analogy.",
  "engine.gradeGood": "Good — that captures the core idea.",
  "engine.gradeClose": "Close, but revisit the definition and try again.",
  "signin.invalidName": "Pick a name between 2 and 24 characters (letters, numbers, spaces).",
  "signin.password": "Password",
  "signin.passwordPlaceholder": "Password",
  "signin.passwordHint": "New name? You set your password here. Coming back? Enter it to unlock your profile.",
  "signin.wrongPassword": "Wrong password for this name.",
  "signin.tooManyAttempts": "Too many attempts. Wait a moment, then try again.",
  "signin.passwordRequired": "Set a password to protect your account.",
  "signin.passwordTooShort": "Password too short — at least 6 characters.",
  "signin.ownerToggle": "I have an owner code",
  "signin.ownerPlaceholder": "Owner code (optional)",
};

export type Dict = typeof en;
