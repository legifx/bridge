"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BridgeViz } from "@/components/BridgeViz";

type Body = {
  opening: string;
  correspondences: { subject: string; yourWorld: string; explanation: string }[];
  breaksDown: string;
  plainRestatement: string;
};
type Panel = { displayName: string; domainName: string | null; similarity: number; body: Body | null };
type Data = { concept: string; labels: string[]; panels: Panel[]; error?: string };

export default function Compare() {
  const [data, setData] = useState<Data | null>(null);
  const [concept, setConcept] = useState<string | null>(null);

  useEffect(() => {
    const q = concept ? `?concept=${encodeURIComponent(concept)}` : "";
    fetch(`/api/compare${q}`)
      .then((r) => r.json())
      .then(setData);
  }, [concept]);

  return (
    <main className="mx-auto w-full max-w-[1000px] px-5 py-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-curriculum">Same concept · two worlds</p>
          <h1 className="font-display text-2xl text-ink">One idea, explained two ways</h1>
        </div>
        <Link href="/" className="font-mono text-xs text-ink-soft underline underline-offset-4">
          back
        </Link>
      </header>

      {data?.error && <p className="text-sm text-ink-soft">{data.error}</p>}

      {data && data.labels?.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {data.labels.map((l) => (
            <button
              key={l}
              onClick={() => setConcept(l)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                data.concept === l ? "border-curriculum bg-curriculum text-white" : "border-line bg-paper-raised text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.panels.map((p, i) => (
          <div key={i} className="rounded-[--radius] border border-line bg-paper-raised p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="font-display text-base text-ink">{p.displayName}</span>
              {p.domainName && (
                <span className="rounded-full border border-interest bg-interest-soft px-2.5 py-0.5 text-xs font-medium text-interest">
                  {p.domainName}
                </span>
              )}
            </div>
            {p.body ? (
              <>
                <BridgeViz
                  conceptLabel={data.concept}
                  domainName={p.domainName ?? ""}
                  similarity={p.similarity}
                  correspondences={p.body.correspondences}
                  animate={false}
                />
                <p className="mt-3 text-sm text-ink">{p.body.opening}</p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">No pre-generated bridge for this profile yet.</p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Same facts, same concept, same assessment — only the explanation is re-expressed through each
        learner&rsquo;s world.
      </p>
    </main>
  );
}
