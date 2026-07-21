"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { CHEM_SOURCE_TEXT } from "@/lib/demo/chem";

const STAGES = ["Reading page", "Extracting concepts", "Linking prerequisites"];

/** Downscale an image to a max long edge before upload — saves tokens + latency (§2). */
async function downscale(file: File, maxEdge = 1600): Promise<string> {
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

export default function Capture() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPreview(await downscale(file));
    } catch {
      setError("Could not read that image. Try another.");
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    setStage(0);
    const ticker = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 700);
    try {
      const body = preview ? { images: [{ dataUrl: preview }] } : { text };
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed.");
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  }

  const canRun = !busy && (preview !== null || text.trim().length > 0);

  return (
    <Shell>
      <header className="mb-5">
        <h1 className="font-display text-2xl text-ink">Capture material</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Snap a page, or paste text. Bridge turns it into a concept map — in the subject&rsquo;s own words.
        </p>
      </header>

      <div className="space-y-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-[--radius] border-2 border-dashed border-curriculum/40 bg-paper-raised py-8 text-curriculum"
        >
          <span className="text-3xl leading-none">＋</span>
          <span className="font-medium">{preview ? "Retake photo" : "Take / choose a photo"}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="captured page" className="w-full rounded-[--radius] border border-line" />
        )}

        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <span className="h-px flex-1 bg-line" /> or paste text <span className="h-px flex-1 bg-line" />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a paragraph from your notes or textbook…"
          rows={6}
          className="w-full resize-y rounded-[--radius] border border-line bg-paper p-3 text-base text-ink outline-none focus:border-curriculum focus:ring-2 focus:ring-curriculum/30"
        />
        <button
          onClick={() => setText(CHEM_SOURCE_TEXT)}
          disabled={busy}
          className="text-sm font-medium text-curriculum underline underline-offset-4"
        >
          Use demo chapter
        </button>
      </div>

      {busy && (
        <ol className="mt-6 space-y-2" aria-live="polite">
          {STAGES.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  i < stage ? "bg-ok" : i === stage ? "animate-pulse bg-curriculum" : "bg-line"
                }`}
              />
              <span className={i <= stage ? "text-ink" : "text-ink-soft"}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p className="mt-5 rounded-[--radius] border border-bad/40 bg-bad/5 p-3 text-sm text-bad">{error}</p>
      )}

      <button
        onClick={run}
        disabled={!canRun}
        className="mt-6 w-full rounded-[--radius] bg-curriculum py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Working…" : "Build concept map"}
      </button>
    </Shell>
  );
}
