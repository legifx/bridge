import { NextResponse } from "next/server";
import { z } from "zod";
import { extractConceptGraph } from "@/lib/extraction";
import { saveConceptGraph } from "@/lib/extraction/persist";
import { getCurrentLearner } from "@/lib/db/learner";

import { recordSignal, averageVec } from "@/lib/brain/record";
import { apiError } from "@/lib/api/errors";

// Embeddings + LLM need the Node runtime, not the edge runtime.
export const runtime = "nodejs";
// Serverless ceiling: vision OCR over up to 16 scanned pages.
// 60s is the ceiling every Vercel plan allows and 4x the platform default;
// raise it in vercel.json on plans that permit more.
export const maxDuration = 60;

const BodySchema = z.object({
  // PDFs/DOCX can carry far more text than a pasted paragraph.
  text: z.string().min(1).max(120000).optional(),
  // data URLs of already-downscaled images (client caps the long edge at 1600px).
  // Multi-page captures (scanned PDFs) send one image per page.
  images: z.array(z.object({ dataUrl: z.string().startsWith("data:") })).max(16).optional(),
  // what the material originally was — the binary itself is never uploaded.
  kind: z.enum(["photo", "pdf", "docx", "text"]).optional(),
  fileName: z.string().max(200).optional(),
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

  // Capture itself is free — the demo budget is spent per learning aspect when
  // the learner actually studies a concept (see chargeConcept). Uploading
  // material and getting the concept list never strands the learner.
  try {
    const { graph, embeddings, markdown } = await extractConceptGraph({
      text: parsed.data.text,
      images: parsed.data.images,
      language: learner.language,
    });

    const kind =
      parsed.data.kind ?? (parsed.data.images?.length ? "photo" : "text");

    // Storage stays lightweight: the learner's permanent copy is the Markdown
    // transcription (plus any pasted text) — never the image/PDF/DOCX binary.
    const header = parsed.data.fileName ? `<!-- source: ${parsed.data.fileName} -->\n\n` : "";
    const rawText =
      kind === "text"
        ? parsed.data.text ?? ""
        : header + (markdown ?? parsed.data.text ?? "(no transcription)");

    const { sourceId } = await saveConceptGraph({
      learnerId: learner.id,
      kind,
      rawText,
      graph,
      embeddings,
      existingSourceId: parsed.data.sourceId,
    });

    // Feed the second brain: what a learner captures is itself a signal. The
    // embedding is averaged from the concept vectors we just computed, so this
    // also works where the local model is unavailable (serverless).
    try {
      const vecs = [...embeddings.values()];
      if (vecs.length > 0) {
        await recordSignal({
          learnerId: learner.id,
          kind: "signal",
          label: graph.title,
          text: `${graph.title}${graph.subject ? ` (${graph.subject})` : ""}: ${graph.concepts
            .map((c) => c.label)
            .join(", ")}`,
          weight: 2,
          embedding: averageVec(vecs),
          sourceRef: sourceId,
        });
      }
    } catch (err) {
      console.warn("extract: brain signal failed (non-fatal)", err);
    }

    return NextResponse.json({ sourceId, graph, quota: null });
  } catch (err) {
    return apiError("extract", err, learner.language);
  }
}
