/**
 * Seeded demo source: one real chemistry chapter — "Chemical bonding".
 * Subject is deliberately NOT software (§8) so the product doesn't look like it
 * only works for tech people. Seed source for the two demo profiles.
 */
import type { ExtractionResult } from "@/lib/extraction/types";

export const CHEM_SOURCE_TEXT = `Chemical bonding.

Atoms are the basic units of matter. Each atom has a nucleus surrounded by electrons.
The electrons in the outermost shell are called valence electrons, and they determine
how an atom bonds. Atoms are most stable with a full outer shell of eight electrons —
the octet rule.

Electronegativity is the tendency of an atom to attract electrons. When two atoms have
very different electronegativities, one atom can transfer valence electrons to the other.
The atom that loses electrons becomes a positive ion (cation); the atom that gains them
becomes a negative ion (anion).

An ionic bond is the electrostatic attraction between oppositely charged ions. Sodium
chloride (table salt) is held together by ionic bonds.

When two atoms have similar electronegativities, neither can take the other's electrons,
so they share pairs of valence electrons instead. This shared pair is a covalent bond,
and the resulting particle is a molecule. Water is a molecule held together by covalent
bonds.`;

export const CHEM_EXTRACTION: ExtractionResult = {
  title: "Chemical bonding",
  concepts: [
    {
      id: "atom",
      label: "Atom",
      definition: "The basic unit of matter, made of a nucleus surrounded by electrons.",
      sourceQuote: "Atoms are the basic units of matter.",
      difficulty: 1,
      prerequisiteIds: [],
    },
    {
      id: "valence-electron",
      label: "Valence electron",
      definition:
        "An electron in an atom's outermost shell; valence electrons determine how an atom bonds.",
      sourceQuote:
        "The electrons in the outermost shell are called valence electrons, and they determine how an atom bonds.",
      difficulty: 2,
      prerequisiteIds: ["atom"],
    },
    {
      id: "octet-rule",
      label: "Octet rule",
      definition: "Atoms are most stable when their outer shell holds eight electrons.",
      sourceQuote: "Atoms are most stable with a full outer shell of eight electrons — the octet rule.",
      difficulty: 2,
      prerequisiteIds: ["valence-electron"],
    },
    {
      id: "electronegativity",
      label: "Electronegativity",
      definition: "The tendency of an atom to attract electrons.",
      sourceQuote: "Electronegativity is the tendency of an atom to attract electrons.",
      difficulty: 3,
      prerequisiteIds: ["valence-electron"],
    },
    {
      id: "ion",
      label: "Ion",
      definition:
        "A charged atom: a cation has lost valence electrons (positive), an anion has gained them (negative).",
      sourceQuote:
        "The atom that loses electrons becomes a positive ion (cation); the atom that gains them becomes a negative ion (anion).",
      difficulty: 3,
      prerequisiteIds: ["valence-electron", "electronegativity"],
    },
    {
      id: "ionic-bond",
      label: "Ionic bond",
      definition: "The electrostatic attraction between oppositely charged ions.",
      sourceQuote: "An ionic bond is the electrostatic attraction between oppositely charged ions.",
      difficulty: 4,
      prerequisiteIds: ["ion", "octet-rule"],
    },
    {
      id: "covalent-bond",
      label: "Covalent bond",
      definition:
        "A bond formed when two atoms of similar electronegativity share pairs of valence electrons.",
      sourceQuote: "This shared pair is a covalent bond",
      difficulty: 4,
      prerequisiteIds: ["electronegativity", "octet-rule"],
    },
    {
      id: "molecule",
      label: "Molecule",
      definition: "A particle formed of atoms held together by covalent bonds, such as water.",
      sourceQuote: "the resulting particle is a molecule",
      difficulty: 3,
      prerequisiteIds: ["covalent-bond"],
    },
  ],
};
