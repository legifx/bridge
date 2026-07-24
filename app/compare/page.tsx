import Compare from "./compare-page";

/**
 * Side-by-side: the same concept explained through two different learners'
 * worlds. Reads pre-generated bridges of the seeded demo profiles only (see
 * /api/compare), so it needs no sign-in and no API key.
 */
export default function ComparePage() {
  return <Compare />;
}
