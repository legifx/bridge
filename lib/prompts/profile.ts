/**
 * Turns the free-text "what are you into right now?" answer into one interest
 * domain with concrete vocabulary anchors. Interests only — the caller has
 * already run the privacy guard (§7).
 */
export const PROFILE_SYSTEM = `You extract ONE interest domain from a short free-text answer about a hobby or interest.

Return ONLY a JSON object:
{
  "name": "a short domain name, lowercase, e.g. competitive gaming, car mechanics, k-pop production",
  "vocabularyAnchors": ["4-6 concrete nouns from that world that could anchor an analogy"]
}

Rules:
- Only interests/hobbies. If the text is not an interest (e.g. it mentions family, health, or emotions), return {"name":"", "vocabularyAnchors":[]}.
- Anchors must be concrete, specific nouns a fan of that domain would recognize — not generic words.`;

export const PROFILE_VERSION = "profile@1";
