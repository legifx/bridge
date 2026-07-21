/**
 * Dot-matrix LED numerals — the signature readout of the instrument aesthetic.
 * Each glyph is a 5x7 grid of dots; lit dots glow over a faint dot field, exactly
 * like the reference cards. Pure SVG, no font dependency, scales with `dot`.
 */
const FONT: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "11000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "%": ["11001", "11010", "00100", "00100", "01011", "10011", "00000"],
  "°": ["01100", "10010", "10010", "01100", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

export function Led({
  value,
  dot = 4,
  color = "currentColor",
  className = "",
}: {
  value: string | number;
  dot?: number; // dot diameter in px
  color?: string;
  className?: string;
}) {
  const chars = String(value).split("");
  const step = dot * 1.55; // dot pitch
  const r = dot / 2;
  const cellW = 5 * step;
  const cellH = 7 * step;
  const gap = step * 0.9;

  return (
    <span className={`inline-flex items-end ${className}`} style={{ gap, color, lineHeight: 0 }}>
      {chars.map((ch, i) => {
        const grid = FONT[ch] ?? FONT[" "];
        return (
          <svg
            key={i}
            width={cellW}
            height={cellH}
            viewBox={`0 0 ${cellW} ${cellH}`}
            aria-hidden
            style={{ display: "block", overflow: "visible" }}
          >
            {grid.flatMap((row, y) =>
              row.split("").map((bit, x) => {
                const on = bit === "1";
                return (
                  <circle
                    key={`${x}-${y}`}
                    cx={x * step + step / 2}
                    cy={y * step + step / 2}
                    r={r}
                    fill={on ? color : "rgba(255,255,255,0.06)"}
                    style={on ? { filter: `drop-shadow(0 0 ${dot}px ${color})` } : undefined}
                  />
                );
              }),
            )}
          </svg>
        );
      })}
      <span className="sr-only">{String(value)}</span>
    </span>
  );
}
