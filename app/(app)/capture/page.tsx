"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { ThinkingLoader } from "@/components/ThinkingLoader";
import { useT } from "@/components/LanguageProvider";
import { CHEM_SOURCE_TEXT } from "@/lib/demo/chem";
import type { ReadResult } from "@/lib/capture/readFile";

type Attachment = ReadResult & { fileName: string };

function CaptureForm() {
  const t = useT();
  const router = useRouter();
  const sourceId = useSearchParams().get("source");
  const [folderTitle, setFolderTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId) return;
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => {
        const src = d.sources?.find((s: { id: string }) => s.id === sourceId);
        if (src) setFolderTitle(src.title);
      })
      .catch(() => {});
  }, [sourceId]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAttachment(null);
    try {
      // pdfjs/mammoth are heavy — loaded only once a file is actually picked.
      const { readCaptureFile } = await import("@/lib/capture/readFile");
      const result = await readCaptureFile(file);
      setAttachment({ ...result, fileName: file.name });
    } catch {
      setError(file.type.startsWith("image/") ? t("cap.badImage") : t("cap.badFile"));
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const base = attachment
        ? {
            kind: attachment.kind,
            fileName: attachment.fileName,
            text: attachment.text,
            images: attachment.images?.map((dataUrl) => ({ dataUrl })),
          }
        : { text };
      const body = sourceId ? { ...base, sourceId } : base;
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = "/signin?expired=1";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("cap.extractFailed"));
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const canRun = !busy && (attachment !== null || text.trim().length > 0);
  const photoPreview = attachment?.kind === "photo" ? attachment.images?.[0] : null;

  return (
    <Shell>
      <PageHead
        eyebrow={t("cap.eyebrow")}
        title={folderTitle ? t("cap.titleInto", { title: folderTitle }) : t("cap.title")}
        sub={folderTitle ? t("cap.subInto") : t("cap.subNew")}
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
          {attachment ? t("cap.retake") : t("cap.takePhoto")}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onFile}
        className="hidden"
      />

      {photoPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPreview}
          alt="captured page"
          className="mt-4 w-full"
          style={{ borderRadius: "var(--r-lg)" }}
        />
      )}

      {attachment && attachment.kind !== "photo" && (
        <div
          className="mt-4 bg-white/[0.05] p-4 text-sm text-text"
          style={{ borderRadius: "var(--r)" }}
        >
          <p className="font-medium">{t("cap.fileReady", { name: attachment.fileName })}</p>
          {attachment.pages && attachment.pages.used < attachment.pages.total && (
            <p className="mt-1 text-xs text-faint">
              {t("cap.pagesPartial", {
                used: attachment.pages.used,
                total: attachment.pages.total,
              })}
            </p>
          )}
        </div>
      )}

      <div className="my-8 flex items-center gap-3">
        <span className="h-px flex-1 bg-hair" />
        <span className="slabel text-faint">{t("cap.orPaste")}</span>
        <span className="h-px flex-1 bg-hair" />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("cap.pastePlaceholder")}
        rows={6}
        className="input resize-y"
      />
      <button
        onClick={() => setText(CHEM_SOURCE_TEXT)}
        disabled={busy}
        className="slabel mt-3 text-curriculum-text transition hover:opacity-80"
      >
        {t("cap.useDemo")}
      </button>

      {busy && (
        <div className="mt-6">
          <ThinkingLoader
            stages={[
              { label: t("cap.think.a") },
              { label: t("cap.think.b"), detail: t("cap.think.bd") },
              { label: t("cap.think.c") },
              { label: t("cap.think.d"), detail: t("cap.think.dd") },
            ]}
            glow="var(--curriculum)"
            expectedMs={12000}
          />
        </div>
      )}

      {error && (
        <p
          className="mt-5 bg-[rgba(255,51,85,0.1)] p-4 text-sm text-reject-text"
          style={{ borderRadius: "var(--r)" }}
        >
          {error}
        </p>
      )}

      <button
        onClick={run}
        disabled={!canRun}
        className={`btn mt-6 w-full ${busy ? "btn-working" : "btn-primary"}`}
      >
        {busy ? t("cap.working") : folderTitle ? t("cap.addToFolder") : t("cap.build")}
      </button>
    </Shell>
  );
}

export default function Capture() {
  return (
    <Suspense fallback={null}>
      <CaptureForm />
    </Suspense>
  );
}
