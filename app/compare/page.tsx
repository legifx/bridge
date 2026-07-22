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
    <main className="mx-auto w-full max-w-[1000px] px-5 pb-20 pt-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Same concept · two worlds</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">One idea, two ways</h1>
        </div>
        <Link href="/" className="slabel pt-1 text-faint transition hover:text-text">
          back
        </Link>
      </header>

      {data?.error && <p className="text-sm text-faint">{data.error}</p>}

      {data && data.labels?.length > 0 && (
        <div className="mb-7 flex flex-wrap gap-2">
          {data.labels.map((l) => {
            const active = data.concept === l;
            return (
              <button
                key={l}
                onClick={() => setConcept(l)}
                className={`chip transition ${active ? "chip-curriculum" : "text-dim hover:text-text"}`}
                style={active ? undefined : { background: "rgba(255,255,255,0.05)" }}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        {data?.panels.map((p, i) => (
          <div key={i} className="space-y-3">
            <div className="flex h-8 items-center justify-between px-1">
              <span className="text-base font-semibold tracking-tight text-text">{p.displayName}</span>
              {p.domainName && <span className="chip chip-interest">{p.domainName}</span>}
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
              <div className="card p-5 text-sm text-faint">
                No pre-generated bridge for this profile yet.
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-sm leading-relaxed text-dim">
        Same facts, same concept, same assessment — only the explanation is re-lit through each
        learner&rsquo;s world.
      </p>
    </main>
  );
}
