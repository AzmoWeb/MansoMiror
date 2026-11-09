import { githubUrl } from "@/content/site";
import { platforms, latestRelease, formatSize } from "@/content/releases";
import { Reveal } from "../Reveal";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export function Downloads() {
  const rows = platforms.map((p) => ({ p, r: latestRelease(p.id) }));
  const anyPublished = rows.some((x) => x.r);

  return (
    <section id="telecharger" className="border-t border-line bg-bg-subtle py-20 md:py-28">
      <div className="container-page">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Téléchargements</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
            {anyPublished ? "Téléchargez MansoMirror." : "Bientôt disponible."}
          </h2>
          {!anyPublished && (
            <p className="mt-4 text-muted" data-testid="no-release">
              Aucune version n'est publiée pour le moment. Les téléchargements apparaîtront ici, avec leur taille et leur
              empreinte SHA-256, dès qu'une version aura été compilée, signée et testée.
            </p>
          )}
        </Reveal>

        <div className="mt-10 overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map(({ p, r }) => (
            <div key={p.id} className="grid gap-3 border-b border-line p-5 last:border-b-0 md:grid-cols-[1.2fr_1.6fr_auto] md:items-center md:gap-6">
              <div>
                <p className="font-display text-lg font-semibold">{p.name}</p>
                <p className="text-sm text-muted">{p.app}</p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-subtle">Version</dt>
                <dd className="font-mono">{r ? r.version : "—"}</dd>
                <dt className="text-subtle">Publiée le</dt>
                <dd>{r ? dateFmt.format(new Date(r.publishedAt)) : "—"}</dd>
                <dt className="text-subtle">Taille</dt>
                <dd className="font-mono">{r ? formatSize(r.sizeBytes) : "—"}</dd>
                <dt className="text-subtle">Configuration</dt>
                <dd>{p.requirements}</dd>
              </dl>
              {r ? (
                <a href={r.url} className="btn btn-primary" download>
                  Télécharger
                </a>
              ) : (
                <span className="btn cursor-default border border-dashed border-line-strong text-subtle" aria-disabled="true">
                  Pas encore disponible
                </span>
              )}
            </div>
          ))}
        </div>
        {!anyPublished && (
          <p className="mt-5 text-sm text-muted">
            Suivez l'avancement sur{" "}
            <a href={githubUrl} className="font-medium text-accent-ink underline underline-offset-4">
              GitHub
            </a>
            .
          </p>
        )}
      </div>
    </section>
  );
}
