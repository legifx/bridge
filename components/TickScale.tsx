/**
 * A thin tick-mark gauge: a row of 1px hairline ticks with a colored pointer at
 * `value` (0..1). Ticks near the pointer light up. Pure instrument furniture —
 * used under LED readouts, exactly like the reference cards.
 */
export function TickScale({
  value = 0.5,
  color = "var(--curriculum)",
  count = 44,
  className = "",
}: {
  value?: number;
  color?: string;
  count?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  const activeIndex = Math.round(v * (count - 1));
  return (
    <div className={`relative h-6 w-full ${className}`} aria-hidden>
      <div className="flex h-4 w-full items-end justify-between">
        {Array.from({ length: count }).map((_, i) => {
          const dist = Math.abs(i - activeIndex);
          const near = dist <= 1;
          const tall = i % 6 === 0;
          return (
            <span
              key={i}
              style={{
                width: 1,
                height: near ? 16 : tall ? 12 : 7,
                background: near ? color : "rgba(255,255,255,0.22)",
                boxShadow: near ? `0 0 6px ${color}` : undefined,
              }}
            />
          );
        })}
      </div>
      {/* pointer */}
      <span
        className="absolute top-0"
        style={{
          left: `${v * 100}%`,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: `5px solid ${color}`,
          filter: `drop-shadow(0 0 5px ${color})`,
        }}
      />
    </div>
  );
}
