import { steps } from "@/content/site";
import { Reveal } from "../Reveal";

export function HowItWorks() {
  return (
    <section id="fonctionnement" className="border-t border-line bg-bg-subtle py-20 md:py-28">
      <div className="container-page">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Comment ça marche ?</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Trois étapes, aucune configuration réseau.</h2>
        </Reveal>
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute left-0 right-0 top-5 hidden h-px bg-line-strong md:block" />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <li className="relative">
                <span className="relative grid size-10 place-items-center rounded-full border border-line-strong bg-bg font-mono text-sm font-semibold text-accent-ink">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
