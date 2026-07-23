/**
 * Client-side file reading for capture. The binary never leaves the browser:
 * PDFs and DOCX are converted here to text and/or page images, and only that
 * lightweight payload is sent to /api/extract. This keeps the server free of
 * stored binaries (the permanent copy is the Markdown transcription).
 *
 * Import this module dynamically — pdfjs/mammoth are heavy and only needed
 * once a file is actually picked.
 */

export type ReadResult = {
  kind: "photo" | "pdf" | "docx";
  /** extracted embedded text, if the document had a usable text layer. */
  text?: string;
  /** downscaled JPEG data URLs (photo, or rendered pages of a scanned PDF). */
  images?: string[];
  /** how many pages the document had vs how many we actually sent. */
  pages?: { total: number; used: number };
};

/** Scanned PDFs are sent as page images — cap pages to protect the AI budget. */
const MAX_PDF_PAGE_IMAGES = 12;
/** Below this much embedded text per page, treat the PDF as scanned. */
const MIN_TEXT_PER_PAGE = 120;

export async function downscaleImage(file: Blob, maxEdge = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function readPdf(file: File): Promise<ReadResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const total = doc.numPages;

  // First try the embedded text layer — by far the cheapest, most faithful path.
  const pageTexts: string[] = [];
  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pageTexts.push(text);
  }
  const fullText = pageTexts.join("\n\n").trim();

  if (fullText.length >= MIN_TEXT_PER_PAGE * total) {
    return { kind: "pdf", text: fullText, pages: { total, used: total } };
  }

  // Scanned / image-only PDF: render pages to downscaled JPEGs for the vision model.
  const used = Math.min(total, MAX_PDF_PAGE_IMAGES);
  const images: string[] = [];
  for (let p = 1; p <= used; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85));
  }
  return {
    kind: "pdf",
    text: fullText.length > 0 ? fullText : undefined,
    images,
    pages: { total, used },
  };
}

async function readDocx(file: File): Promise<ReadResult> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = value.replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("empty-docx");
  return { kind: "docx", text };
}

/** Read any supported capture file into an extract-ready payload. */
export async function readCaptureFile(file: File): Promise<ReadResult> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return readPdf(file);
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return readDocx(file);
  }
  return { kind: "photo", images: [await downscaleImage(file)] };
}
