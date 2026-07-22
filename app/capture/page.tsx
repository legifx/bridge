"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { CHEM_SOURCE_TEXT } from "@/lib/demo/chem";

const STAGES = ["Reading page", "Extracting concepts", "Linking prerequisites"];

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
      <PageHead
        eyebrow="Capture"
        title="Add material"
        sub="Snap a page or paste text — in the subject’s own words."
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="aura card ring-focus flex w-full flex-col items-center justify-center gap-3 py-12"
        style={
          {
            "--glow": "var(--curriculum)",
            "--aura-y": "50%",
            "--aura-strength": 0.55,
          } as React.CSSProperties
        }
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
          style={{ background: "rgba(255,255,255,0.1)", boxShadow: "0 0 24px rgba(59,123,255,0.5)" }}
        >
          +
        </span>
        <span className="text-sm font-medium text-text">
          {preview ? "Retake photo" : "Take / choose a photo"}
        </span>
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
        <img
          src={preview}
          alt="captured page"
          className="mt-4 w-full"
          style={{ borderRadius: "var(--r-lg)" }}
        />
      )}

      <div className="my-8 flex items-center gap-3">
        <span className="h-px flex-1 bg-hair" />
        <span className="slabel text-faint">or paste</span>
        <span className="h-px flex-1 bg-hair" />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a paragraph from your notes…"
        rows={6}
        className="input resize-y"
      />
      <button
        onClick={() => setText(CHEM_SOURCE_TEXT)}
        disabled={busy}
        className="slabel mt-3 text-curriculum-text transition hover:opacity-80"
      >
        use demo chapter ↗
      </button>

      {busy && (
        <ol className="mt-6 space-y-2.5" aria-live="polite">
          {STAGES.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background:
                    i < stage
                      ? "var(--acid)"
                      : i === stage
                        ? "var(--curriculum)"
                        : "rgba(255,255,255,0.15)",
                  boxShadow: i <= stage ? "0 0 10px currentColor" : undefined,
                  color: i < stage ? "var(--acid)" : "var(--curriculum)",
                }}
              />
              <span className={i <= stage ? "text-text" : "text-faint"}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p
          className="mt-5 bg-[rgba(255,51,85,0.1)] p-4 text-sm text-reject-text"
          style={{ borderRadius: "var(--r)" }}
        >
          {error}
        </p>
      )}

      <button onClick={run} disabled={!canRun} className="btn btn-primary mt-6 w-full">
        {busy ? "Working…" : "Build concept map"}
      </button>
    </Shell>
  );
}
