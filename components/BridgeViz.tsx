"use client";

/**
 * The signature visualization (§6): the concept node and the interest-domain
 * node, connected by a drawn line, with the structural correspondences shown as
 * paired rows across it — subject term (curriculum ink) <-> your term (interest
 * accent). This is the one memorable image and the frozen frame of the video.
 */
type Correspondence = { subject: string; yourWorld: string; explanation: string };

export function BridgeViz({
  conceptLabel,
  domainName,
  similarity,
  correspondences,
  animate = true,
}: {
  conceptLabel: string;
  domainName: string;
  similarity: number;
  correspondences: Correspondence[];
  animate?: boolean;
}) {
  return (
    <div className="rounded-[--radius] border border-line bg-paper-raised p-4">
      {/* the two nodes + the drawn bridge line */}
      <div className="relative mb-4 flex items-center justify-between gap-2">
        <span className="z-10 max-w-[42%] rounded-full border border-curriculum bg-curriculum-soft px-3 py-1.5 font-display text-sm text-curriculum">
          {conceptLabel}
        </span>
        <svg
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-8 w-full -translate-y-1/2"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M4 10 Q50 -4 96 10"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={animate ? "bridge-draw" : ""}
          />
        </svg>
        <span className="z-10 max-w-[42%] rounded-full border border-interest bg-interest-soft px-3 py-1.5 text-right font-display text-sm text-interest">
          {domainName}
        </span>
      </div>

      <div className="mb-3 text-center font-mono text-xs text-ink-soft">
        semantic overlap <span className="text-interest">{similarity.toFixed(2)}</span> cosine
        <span className="ml-1 text-ink-soft/70">· bridged anyway by the engine</span>
      </div>

      {/* paired correspondence rows */}
      <ul className="space-y-2">
        {correspondences.map((c, i) => (
          <li
            key={i}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[--radius] bg-paper px-3 py-2"
          >
            <span className="text-sm font-medium text-curriculum">{c.subject}</span>
            <span className="font-mono text-xs text-ink-soft">&harr;</span>
            <span className="text-right text-sm font-medium text-interest">{c.yourWorld}</span>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .bridge-draw {
          stroke-dasharray: 120;
          stroke-dashoffset: 120;
          animation: draw 0.9s ease forwards;
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bridge-draw {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
