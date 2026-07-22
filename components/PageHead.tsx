/** One header pattern for every screen: eyebrow → title → optional subline. */
export function PageHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="mb-10 mt-2">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-text">{title}</h1>
      {sub && <p className="mt-2.5 max-w-md text-sm leading-relaxed text-dim">{sub}</p>}
    </header>
  );
}
