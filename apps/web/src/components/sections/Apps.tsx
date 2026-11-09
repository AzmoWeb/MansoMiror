import { Reveal } from "../Reveal";

const apps = [
  {
    name: "MansoMirror Desktop",
    platforms: "Windows · macOS",
    body: "Le centre de contrôle : il trouve vos appareils, affiche leurs écrans, enregistre les sessions et vous permet de les piloter.",
    status: "Phase 3",
  },
  {
    name: "MansoMirror Mobile",
    platforms: "Android · iOS · iPadOS",
    body: "Partagez l'écran de votre téléphone ou affichez celui de votre ordinateur. Appairage par QR code ou code à 6 chiffres.",
    status: "Phases 4 et 5",
  },
  {
    name: "Compte MansoMirror",
    platforms: "Web",
    body: "Optionnel : retrouvez vos appareils de confiance et connectez-vous à distance, hors de votre réseau local.",
    status: "Phase 6",
  },
];

export function Apps() {
  return (
    <section id="applications" className="border-t border-line bg-bg-subtle py-20 md:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="eyebrow">Applications</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Un écosystème, une seule logique.</h2>
          <p className="mt-4 text-muted">
            Les mêmes gestes, le même vocabulaire et la même sécurité, que vous soyez sur votre ordinateur ou votre téléphone.
          </p>
        </Reveal>
        <div className="divide-y divide-line border-y border-line">
          {apps.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.06}>
              <article className="grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:gap-6">
                <div>
                  <h3 className="font-display text-xl font-semibold">{a.name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-subtle">{a.platforms}</p>
                  <p className="mt-3 max-w-xl text-muted">{a.body}</p>
                </div>
                <p className="self-start rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
                  En développement · {a.status}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
