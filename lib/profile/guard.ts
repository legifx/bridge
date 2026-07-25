/**
 * Privacy guard (§7). Onboarding's free-text field must only capture interests —
 * never family, emotions, health, or anything sensitive. We refuse such input
 * before it is ever embedded or stored.
 *
 * This is a deliberately conservative keyword screen, not sentiment analysis:
 * cheap, transparent, and it fails safe.
 *
 * It covers all ten interface languages. An English-only list protected exactly
 * the learners who happen to type in English — no protection at all in an app
 * that ships in ten. "Depression", "meine Mutter" and "мама" went straight
 * through.
 *
 * Two kinds of entry, because the difference matters:
 *   STEMS  match a prefix (`depress` → depression, depressed, Depressionen).
 *   WORDS  must stand alone (`din` is Turkish for religion, but it also opens
 *          `dinlemek`, "to listen").
 * Both use Unicode-aware boundaries — JavaScript's `\b` is ASCII-only, so a
 * Cyrillic or Arabic term would otherwise match inside longer words.
 *
 * Bare deity names ("god", "Gott", "dio") and the bare word "race" are left out
 * on purpose: "Greek gods", "God of War" and "drag race" are ordinary interests
 * for exactly this audience, and refusing them teaches learners that the field
 * is broken rather than careful.
 */

function pattern(stems: string[], words: string[] = []): RegExp {
  const parts: string[] = [];
  if (stems.length) parts.push(`(?:${stems.join("|")})`);
  if (words.length) parts.push(`(?:${words.join("|")})(?![\\p{L}\\p{N}])`);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join("|")})`, "iu");
}

const BLOCKED_PATTERNS: Array<{ re: RegExp; topic: string }> = [
  {
    topic: "health",
    re: pattern(
      [
        // en
        "depress", "anxiet", "anxious", "suicid", "self[-\\s]?harm", "therap", "diagnos",
        "disease", "illness", "medicat", "autis", "disorder", "disabilit",
        // de
        "depressi", "angstst", "selbstmord", "suizid", "psycholog", "krankheit", "medikament",
        "behinderung", "essst[öo]r", "magersucht",
        // es / pt
        "depresi", "ansiedad", "enfermedad", "medicaci", "terapi", "trastorno", "discapacidad",
        "depress[ãa]o", "ansiedade", "doen[çc]a", "medicament", "defici[êe]ncia",
        // fr
        "d[ée]press", "anxi[ée]t", "maladie", "m[ée]dicament", "handicap",
        // it
        "ansia", "malattia", "farmac", "disturbo", "disabilit",
        // tr
        "depresyon", "intihar", "hastal[ıi]k", "terapi", "engelli",
        // pl
        "depresj", "samob[óo]j", "choroba", "lekarstw", "niepe[łl]nospraw",
        // uk
        "депрес", "тривог", "самогубств", "хвороб", "терапі", "інвалід",
        // ar
        "اكتئاب", "انتحار", "مرض", "إعاقة",
      ],
      ["adhd", "panic", "mental health", "krank", "ilaç", "ilac", "ліки", "دواء", "قلق"],
    ),
  },
  {
    topic: "family",
    re: pattern(
      [
        "divorce", "family", "sibling", "brother", "sister", "mother", "father", "parent",
        "mutter", "vater", "eltern", "scheidung", "familie", "geschwister", "bruder", "schwester",
        "madre", "padre", "familia", "hermano", "hermana", "divorcio", "fam[íi]lia", "irm[ãa]",
        "m[èe]re", "p[èe]re", "famille", "fr[èe]re", "divorc",
        "famiglia", "fratello", "sorella", "divorzio",
        // Turkish glues possessives onto the noun (anne → annem, "my mother"),
        // so these have to be stems, not standalone words.
        "anne", "baba", "aile", "karde[şs]", "bo[şs]anma",
        "matka", "ojciec", "rodzin", "siostra", "rozw[óo]d",
        "мама", "мати", "тато", "батьк", "сім", "родин", "сестр", "розлучен",
        "عائل", "أسرة", "طلاق",
      ],
      // "brat" stays a standalone word: as a stem it would refuse "Bratwurst".
      ["mom", "mum", "dad", "mama", "papa", "m[ãa]e", "pai", "s[œoe]ur",
       "brat", "брат", "أمي", "أبي", "أخي", "أختي"],
    ),
  },
  {
    topic: "emotions",
    re: pattern(
      [
        "depressed", "lonely", "afraid", "scared", "grief", "trauma",
        "einsam", "traurig", "w[üu]tend", "trauer", "verzweifel",
        "triste", "enfadad", "duelo", "sozinh", "raiva",
        "col[èe]re", "solitudine", "arrabbiat",
        "yaln[ıi]z", "[üu]zg[üu]n", "[öo]fke",
        "samotn", "smutn", "[żz]a[łl]ob",
        "самотн", "сумн", "травм",
        "حزين", "غاضب", "صدمة",
      ],
      ["sad", "angry", "angst", "miedo", "medo", "peur", "paura", "korku", "strach", "страх",
       "горе", "lutto", "yas", "وحيد", "حزن"],
    ),
  },
  {
    topic: "beliefs",
    re: pattern(
      [
        "religio", "religi", "church", "mosque", "faith", "praying", "prayer",
        "kirche", "moschee", "glaube", "beten",
        "iglesia", "mezquita", "rezar", "igreja",
        "[ée]glise", "mosqu[ée]e", "pri[èe]re",
        "chiesa", "moschea", "preghiera",
        "kilise", "namaz",
        "ko[śs]ci[óo][łl]", "meczet", "modl",
        "релігі", "церкв", "мечеть", "молитв",
        "كنيسة", "مسجد", "صلاة", "إيمان",
      ],
      ["pray", "din", "dini", "dua", "b[óo]g"],
    ),
  },
  {
    topic: "identity",
    re: pattern(
      [
        "sexual", "orientation", "ethnic", "immigrat", "racism", "racist",
        "geschlecht", "sexuell", "sexualit", "migration", "fl[üu]chtling", "hautfarbe", "rassis",
        "orientaci[óo]n", "inmigra", "imigra", "sexualid",
        "sexualit", "ethni", "immigr",
        "sessual", "immigra",
        "cinsiyet", "cinsel", "etnik", "g[öo][çc]men",
        "seksualn", "etnicz", "imigran", "uchod[źz]c",
        "сексуальн", "етнічн", "мігра", "біжен",
        "الميول", "هجرة", "لاجئ",
      ],
      ["gender", "genre", "genere", "etnia", "p[łl]e[ćc]", "стать", "جنس", "عرق"],
    ),
  },
];

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; topic: string; message: string };

export function checkInterestText(raw: string): GuardResult {
  const text = raw.trim();
  if (!text) return { ok: true, text: "" };
  for (const { re, topic } of BLOCKED_PATTERNS) {
    if (re.test(text)) {
      return {
        ok: false,
        topic,
        message:
          "Bridge only needs your interests — tell us about a hobby or something you're into, not personal details.",
      };
    }
  }
  return { ok: true, text };
}
