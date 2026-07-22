import { NextResponse } from "next/server";
import { z } from "zod";
import { extractConceptGraph } from "@/lib/extraction";
import { saveConceptGraph } from "@/lib/extraction/persist";
import { getCurrentLearner } from "@/lib/db/learner";
import { chargeAi, quotaExceededResponse } from "@/lib/quota";

// Embeddings + LLM need the Node runtime, not the edge runtime.
export const runtime = "nodejs";

const BodySchema = z.object({
  text: z.string().min(1).max(20000).optional(),
  // data URLs of already-downscaled images (client caps the long edge at 1600px).
  images: z.array(z.object({ dataUrl: z.string().startsWith("data:") })).optional(),
  // append into an existing capture folder instead of creating a new one
  sourceId: z.string().optional(),
});

export async function POST(req: Request) {
  const learner = await getCurrentLearner();
  if (!learner) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success || (!parsed.data.text && !parsed.data.images?.length)) {
    return NextResponse.json({ error: "Provide text or at least one image." }, { status: 400 });
  }

  // Extraction is the most expensive call (vision + long output): 2 units.
  const charge = await chargeAi(learner.id, 2);
  if (!charge.ok) return quotaExceededResponse(charge.quota);

  try {
    const { graph, embeddings } = await extractConceptGraph({
      text: parsed.data.text,
      images: parsed.data.images,
      language: learner.language,
    });

    const { sourceId } = await saveConceptGraph({
      learnerId: learner.id,
      kind: parsed.data.images?.length ? "photo" : "text",
      rawText: parsed.data.text ?? "(image source)",
      graph,
      embeddings,
      existingSourceId: parsed.data.sourceId,
    });

    return NextResponse.json({ sourceId, graph, quota: charge.quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
