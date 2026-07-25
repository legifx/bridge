/**
 * One colour scale for mastery, used by every screen that shows it.
 *
 * There were three: the review log and the brain map used three bands, the
 * concept map used two — so a concept sitting at 20 % looked shaky in one place
 * and merely "forming" in another. The same number has to mean the same thing
 * wherever a learner sees it.
 *
 *   >= 0.66  solid        acid green
 *   >= 0.40  forming      blue
 *   <  0.40  shaky        orange
 */
export const MASTERY_SOLID = 0.66;
export const MASTERY_FORMING = 0.4;

/** Foreground colour for a mastery value (dots, readouts, leaf nodes). */
export function masteryColor(m: number): string {
  if (m >= MASTERY_SOLID) return "#c9ff7a";
  if (m >= MASTERY_FORMING) return "#9dc0ff";
  return "#ffb877";
}

/** The card glow for the same value — same bands, dimmer at the bottom end. */
export function masteryGlow(m: number): string {
  if (m >= MASTERY_SOLID) return "var(--acid)";
  if (m >= MASTERY_FORMING) return "var(--curriculum)";
  return "var(--orange)";
}
