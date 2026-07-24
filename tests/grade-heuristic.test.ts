import { describe, it, expect } from "vitest";
import { heuristicGrade } from "@/lib/quiz";

// The offline fallback that keeps a check alive when the grading call fails.
// It is only an overlap heuristic — but it must work in every language the app
// ships in, not just the ASCII ones.
const concept = (label: string, definition: string) => ({
  id: "c1",
  label,
  definition,
  sourceQuote: definition,
});

describe("heuristicGrade", () => {
  it("credits a good English answer", () => {
    const c = concept("Photosynthesis", "Plants convert light energy into chemical energy stored as sugar.");
    expect(heuristicGrade(c, "Plants convert light energy into sugar, chemical energy").score).toBeGreaterThan(0.5);
  });

  it("credits a good German answer (umlauts and all)", () => {
    const c = concept(
      "Photosynthese",
      "Pflanzen wandeln Lichtenergie in chemische Energie um, die als Zucker gespeichert wird.",
    );
    const score = heuristicGrade(c, "Pflanzen wandeln Lichtenergie in chemische Energie um", "de").score;
    expect(score).toBeGreaterThan(0.5);
  });

  it("credits a good Ukrainian answer", () => {
    const c = concept("Фотосинтез", "Рослини перетворюють світлову енергію на хімічну енергію цукру.");
    const score = heuristicGrade(c, "Рослини перетворюють світлову енергію на хімічну енергію", "uk").score;
    expect(score).toBeGreaterThan(0.5);
  });

  it("credits a good Arabic answer", () => {
    const c = concept("التركيب الضوئي", "تحول النباتات الطاقة الضوئية إلى طاقة كيميائية مخزنة في السكر.");
    const score = heuristicGrade(c, "تحول النباتات الطاقة الضوئية إلى طاقة كيميائية", "ar").score;
    expect(score).toBeGreaterThan(0.5);
  });

  it("does not credit an unrelated answer", () => {
    const c = concept("Photosynthese", "Pflanzen wandeln Lichtenergie in chemische Energie um.");
    expect(heuristicGrade(c, "Ich weiß es leider nicht", "de").score).toBeLessThan(0.5);
  });

  it("scores an empty or one-word answer at zero", () => {
    const c = concept("Photosynthese", "Pflanzen wandeln Lichtenergie in chemische Energie um.");
    expect(heuristicGrade(c, "", "de").score).toBe(0);
    expect(heuristicGrade(c, "Pflanzen", "de").score).toBe(0);
  });
});
