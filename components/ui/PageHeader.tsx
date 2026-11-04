export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5">
      {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember-soft">{eyebrow}</p>}
      <h1 className="fire-text font-head text-2xl font-bold tracking-wide sm:text-3xl">{title}</h1>
      {children && <div className="mt-1 max-w-3xl text-sm text-muted">{children}</div>}
    </header>
  );
}
