import { githubUrl } from "@/content/site";
import { platforms, latestFiles, formatSize } from "@/content/releases";
import { Reveal } from "../Reveal";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export function Downloads() {
  const rows = platforms.map((p) => ({ p, files: latestFiles(p.id) }));
  const anyPublished = rows.some((x) => x.files.length > 0);
  const anyBeta = rows.some((x) => x.files.some((f) => f.prerelease));

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
              empreinte SHA-256, dès qu'une version aura été compilée et testée.
            </p>
          )}
          {anyBeta && (
            <p className="mt-4 text-muted" data-testid="beta-warning">
              Version <strong className="text-ink">bêta</strong> : elle permet de partager l'écran d'un ordinateur avec un autre
              ordinateur du même réseau. Les installeurs ne sont pas encore signés : Windows affichera « Windows a protégé votre
              ordinateur » (cliquez sur « Informations complémentaires » puis « Exécuter quand même ») ; sur macOS, faites un clic
              droit sur l'application puis « Ouvrir ».
            </p>
          )}
        </Reveal>

        <div className="mt-10 overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map(({ p, files }) => {
            const r = files[0];
            return (
              <div key={p.id} data-platform={p.id} className="grid gap-3 border-b border-line p-5 last:border-b-0 md:grid-cols-[1.1fr_1.6fr_auto] md:items-center md:gap-6">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {p.name}
                    {r?.prerelease && <span className="ml-2 rounded-full border border-line-strong px-2 py-0.5 align-middle font-sans text-xs font-medium text-warn-ink">Bêta</span>}
                  </p>
                  <p className="text-sm text-muted">{p.app}</p>
                  {r && p.scope && <p className="mt-1 text-xs text-subtle">{p.scope}</p>}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  <dt className="text-subtle">Version</dt>
                  <dd className="font-mono">{r ? r.version : "—"}</dd>
                  <dt className="text-subtle">Publiée le</dt>
                  <dd>{r ? dateFmt.format(new Date(r.publishedAt)) : "—"}</dd>
                  <dt className="text-subtle">Taille</dt>
                  <dd className="font-mono">{r ? files.map((f) => formatSize(f.sizeBytes)).join(" · ") : "—"}</dd>
                  <dt className="text-subtle">Configuration</dt>
                  <dd>{p.requirements}</dd>
                  {r && (
                    <>
                      <dt className="text-subtle">SHA-256</dt>
                      <dd className="break-all font-mono text-xs text-muted">{files.map((f) => f.sha256.slice(0, 16) + "…").join(" · ")}</dd>
                    </>
                  )}
                </dl>
                {files.length ? (
                  <div className="flex flex-col gap-2">
                    {files.map((f) => (
                      <a key={f.url} href={f.url} className="btn btn-primary" download>
                        {f.format}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="btn cursor-default border border-dashed border-line-strong text-subtle" aria-disabled="true">
                    Pas encore disponible
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-sm text-muted">
          Toutes les versions et leurs empreintes sont publiées sur{" "}
          <a href={`${githubUrl}/releases`} className="font-medium text-accent-ink underline underline-offset-4">
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
