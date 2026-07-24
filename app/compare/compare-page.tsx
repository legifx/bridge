"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";
import { BridgeViz } from "@/components/BridgeViz";
import { useT } from "@/components/LanguageProvider";

type Body = {
  opening: string;
  correspondences: { subject: string; yourWorld: string; explanation: string }[];
  breaksDown: string;
  plainRestatement: string;
};
type Panel = { displayName: string; domainName: string | null; similarity: number; body: Body | null };
type Data = { concept: string; labels: string[]; panels: Panel[]; error?: string };

export default function Compare() {
  const t = useT();
  const [data, setData] = useState<Data | null>(null);
  const [concept, setConcept] = useState<string | null>(null);

  useEffect(() => {
    const q = concept ? `?concept=${encodeURIComponent(concept)}` : "";
    fetch(`/api/compare${q}`)
      .then((r) => r.json())
      .then(setData);
  }, [concept]);

  return (
    <Shell wide>
      <PageHead eyebrow={t("cmp.eyebrow")} title={t("cmp.title")} />

      {data?.error && <p className="text-sm text-faint">{data.error}</p>}

      {data && data.labels?.length > 0 && (
        <div className="-mt-4 mb-10 flex flex-wrap gap-2.5">
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

      {/* Phone-sized screens: the two worlds AT A GLANCE, before the full panels
          stack below. The whole point of this page is simultaneity — "the same
          concept, two learners" is lost if you have to scroll to find the
          second one. */}
      {data && data.panels.length === 2 && data.panels.every((p) => p.body) && (
        <div className="mb-8 grid grid-cols-2 gap-3 md:hidden">
          {data.panels.map((p, i) => (
            <div key={i} className="card p-4">
              <p className="truncate text-sm font-semibold tracking-tight text-text">{p.displayName}</p>
              <p className="mt-1 truncate text-2xs text-interest-text">{p.domainName}</p>
              <ul className="mt-3 space-y-2">
                {p.body!.correspondences.slice(0, 3).map((c, ci) => (
                  <li key={ci} className="text-2xs leading-relaxed">
                    <span className="block truncate text-curriculum-text">{c.subject}</span>
                    <span className="block truncate text-dim">↳ {c.yourWorld}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        {data?.panels.map((p, i) => (
          <div key={i} className="space-y-4">
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
              <div className="card p-6 text-sm text-faint">{t("cmp.noBridge")}</div>
            )}
          </div>
        ))}
      </div>

      <p className="mx-auto mt-12 max-w-xl text-center text-sm leading-relaxed text-dim">
        {t("cmp.footer")}
      </p>
    </Shell>
  );
}
