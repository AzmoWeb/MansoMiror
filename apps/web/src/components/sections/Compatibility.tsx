import { compatColumns, compatRows, supportLabel, type Support } from "@/content/site";
import { Reveal } from "../Reveal";

const style: Record<Support, string> = {
  planned: "text-ok-ink",
  limited: "text-warn-ink",
  studying: "text-muted",
  impossible: "text-danger-ink",
};
function Glyph({ s }: { s: Support }) {
  if (s === "impossible")
    return (
      <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M2 2l6 6M8 2L2 8" />
      </svg>
    );
  const fill = { planned: "bg-current", limited: "bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]", studying: "" }[s];
  return <span aria-hidden="true" className={`size-2.5 rounded-full border-[1.5px] border-current ${fill}`} />;
}

export function Compatibility() {
  const notes: string[] = [];
  return (
    <section id="compatibilite" className="border-t border-line py-20 md:py-28">
      <div className="container-page">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Compatibilité</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Ce que chaque plateforme permettra.</h2>
          <p className="mt-4 text-muted">
            Aucune fonctionnalité n'est encore disponible. Ce tableau décrit ce qui est prévu, et ce que les systèmes
            n'autorisent pas. Il sera mis à jour après les tests sur appareils réels.
          </p>
        </Reveal>

        <Reveal className="mt-10 -mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Fonctionnalités prévues par plateforme</caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-3 pr-4 font-medium text-subtle">Fonctionnalité</th>
                {compatColumns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-3 font-display font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compatRows.map((row) => (
                <tr key={row.feature} className="border-b border-line align-top">
                  <th scope="row" className="py-4 pr-4 font-medium">{row.feature}</th>
                  {row.cells.map((cell, i) => {
                    let ref = "";
                    if (cell.note) {
                      notes.push(cell.note);
                      ref = String(notes.length);
                    }
                    return (
                      <td key={i} className="px-3 py-4">
                        <span className={`inline-flex items-center gap-1.5 ${style[cell.s]}`}>
                          <Glyph s={cell.s} />
                          {supportLabel[cell.s]}
                          {ref && <sup className="font-mono text-[10px] text-subtle">{ref}</sup>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <ol className="mt-6 grid gap-1.5 text-sm text-muted sm:grid-cols-2">
          {notes.map((n, i) => (
            <li key={i}>
              <span className="mr-1.5 font-mono text-xs text-subtle">{i + 1}</span>
              {n}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
