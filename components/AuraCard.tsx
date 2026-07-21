import type { CSSProperties, ReactNode } from "react";

/**
 * A frosted superellipse card with a luminous aura glow that bleeds past its
 * edges. No borders — depth comes from light, blur, and a faint top highlight.
 */
export function AuraCard({
  glow = "var(--curriculum)",
  x = "50%",
  y = "34%",
  strength = 0.85,
  className = "",
  style,
  children,
}: {
  glow?: string;
  x?: string;
  y?: string;
  strength?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={`aura glass lit ${className}`}
      style={
        {
          "--glow": glow,
          "--aura-x": x,
          "--aura-y": y,
          "--aura-strength": strength,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
