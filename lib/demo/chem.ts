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
  subject: "Chemistry",
  concepts: [
    {
      id: "atom",
      label: "Atom",
      definition: "The basic unit of matter, made of a nucleus surrounded by electrons.",
      sourceQuote: "Atoms are the basic units of matter.",
      difficulty: 1,
      prerequisiteIds: [],
      commonMisconceptions: [
        "that electrons orbit the nucleus on fixed circular paths like planets",
        "that an atom is mostly solid matter rather than almost entirely empty space",
      ],
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
      commonMisconceptions: [
        "that all of an atom's electrons take part in bonding, not just the outer-shell ones",
      ],
    },
    {
      id: "octet-rule",
      label: "Octet rule",
      definition: "Atoms are most stable when their outer shell holds eight electrons.",
      sourceQuote: "Atoms are most stable with a full outer shell of eight electrons — the octet rule.",
      difficulty: 2,
      prerequisiteIds: ["valence-electron"],
      commonMisconceptions: [
        "that the rule holds for every element, rather than being a guideline with many exceptions",
        "that atoms want or try to fill their shell, rather than simply ending up in a lower-energy state",
      ],
    },
    {
      id: "electronegativity",
      label: "Electronegativity",
      definition: "The tendency of an atom to attract electrons.",
      sourceQuote: "Electronegativity is the tendency of an atom to attract electrons.",
      difficulty: 3,
      prerequisiteIds: ["valence-electron"],
      commonMisconceptions: [
        "that electronegativity is the same as the number of valence electrons",
        "that a more electronegative atom is simply bigger or heavier",
      ],
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
      commonMisconceptions: [
        "that an ion gains or loses protons rather than electrons",
        "that a cation is negative because it lost something",
      ],
    },
    {
      id: "ionic-bond",
      label: "Ionic bond",
      definition: "The electrostatic attraction between oppositely charged ions.",
      sourceQuote: "An ionic bond is the electrostatic attraction between oppositely charged ions.",
      difficulty: 4,
      prerequisiteIds: ["ion", "octet-rule"],
      commonMisconceptions: [
        "that electrons are handed over as a favour rather than the bond being electrostatic attraction",
        "that an ionic compound consists of separate molecules rather than a lattice",
      ],
    },
    {
      id: "covalent-bond",
      label: "Covalent bond",
      definition:
        "A bond formed when two atoms of similar electronegativity share pairs of valence electrons.",
      sourceQuote: "This shared pair is a covalent bond",
      difficulty: 4,
      prerequisiteIds: ["electronegativity", "octet-rule"],
      commonMisconceptions: [
        "that the shared electrons belong to one of the two atoms rather than to both",
        "that every covalent bond shares its pair equally, ignoring polar bonds",
      ],
    },
    {
      id: "molecule",
      label: "Molecule",
      definition: "A particle formed of atoms held together by covalent bonds, such as water.",
      sourceQuote: "the resulting particle is a molecule",
      difficulty: 3,
      prerequisiteIds: ["covalent-bond"],
      commonMisconceptions: [
        "that the forces between molecules are as strong as the bonds inside them",
      ],
    },
  ],
};
