import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="container-page max-w-3xl py-16 md:py-24">
      <p className="eyebrow">Document provisoire</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-subtle">Dernière mise à jour : {updated}</p>
      <div className="mt-10 space-y-6 leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink">
        {children}
      </div>
    </article>
  );
}
