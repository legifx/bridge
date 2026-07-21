import { NextResponse } from "next/server";
import { z } from "zod";
import { extractConceptGraph } from "@/lib/extraction";
import { saveConceptGraph } from "@/lib/extraction/persist";
import { getOrCreateDemoLearner } from "@/lib/db/learner";
import { isDemoMode } from "@/lib/llm/client";

// Embeddings + LLM need the Node runtime, not the edge runtime.
export const runtime = "nodejs";

const BodySchema = z.object({
  text: z.string().min(1).max(20000).optional(),
  // data URLs of already-downscaled images (Day 2 wires the camera).
  images: z.array(z.object({ dataUrl: z.string().startsWith("data:") })).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success || (!parsed.data.text && !parsed.data.images?.length)) {
    return NextResponse.json(
      { error: "Provide text or at least one image." },
      { status: 400 },
    );
  }

  try {
    const learner = await getOrCreateDemoLearner();
    const { graph, embeddings } = await extractConceptGraph({
      text: parsed.data.text,
      images: parsed.data.images,
      demoKey: "extract:default",
    });

    const { sourceId } = await saveConceptGraph({
      learnerId: learner.id,
      kind: parsed.data.images?.length ? "photo" : "text",
      rawText: parsed.data.text ?? "(image source)",
      graph,
      embeddings,
    });

    return NextResponse.json({ sourceId, demoMode: isDemoMode(), graph });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
