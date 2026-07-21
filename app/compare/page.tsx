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
    <main className="mx-auto w-full max-w-[1000px] px-5 pb-16 pt-8">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.3em] text-faint">Same concept · two worlds</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">One idea, two ways</h1>
        </div>
        <Link href="/" className="font-mono text-2xs uppercase tracking-[0.2em] text-faint hover:text-text">
          back
        </Link>
      </header>

      {data?.error && <p className="text-sm text-faint">{data.error}</p>}

      {data && data.labels?.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {data.labels.map((l) => {
            const active = data.concept === l;
            return (
              <button
                key={l}
                onClick={() => setConcept(l)}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
                style={{
                  background: active ? "rgba(59,123,255,0.18)" : "rgba(255,255,255,0.05)",
                  boxShadow: active ? "inset 0 0 0 1px rgba(59,123,255,0.4), 0 0 18px rgba(59,123,255,0.3)" : undefined,
                  color: active ? "#c9d6ff" : "var(--dim)",
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.panels.map((p, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-base font-semibold text-text">{p.displayName}</span>
              {p.domainName && (
                <span className="rounded-full bg-[rgba(255,59,172,0.14)] px-2.5 py-0.5 text-xs font-medium text-[#ffa6d8] shadow-[0_0_14px_rgba(255,59,172,0.3)]">
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
                <p className="px-1 text-sm leading-relaxed text-dim">{p.body.opening}</p>
              </>
            ) : (
              <div className="glass rounded-[--r-lg] p-4 text-sm text-faint">No pre-generated bridge for this profile yet.</div>
            )}
          </div>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-dim">
        Same facts, same concept, same assessment — only the explanation is re-lit through each
        learner&rsquo;s world.
      </p>
    </main>
  );
}
