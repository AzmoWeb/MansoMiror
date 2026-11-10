import { Reveal } from "../Reveal";

const apps = [
  {
    name: "MansoMirror pour ordinateur",
    platforms: "Windows · macOS · Linux",
    body: "Affiche l'écran du téléphone en grand, avec le son. Captures, enregistrement, plein écran, et contrôle d'Android à la souris.",
    status: "Bêta",
  },
  {
    name: "iPhone et iPad",
    platforms: "iOS · iPadOS",
    body: "Rien à installer : « Recopie de l'écran », dans le Centre de contrôle, suffit. Le code affiché par MansoMirror protège la connexion.",
    status: "Bêta",
  },
  {
    name: "Téléphones Android",
    platforms: "Android 5 et plus récent",
    body: "Rien à installer : activez une fois le débogage USB, branchez le câble — ou passez en Wi-Fi sur Android 11 et plus récent.",
    status: "Bêta",
  },
];

export function Apps() {
  return (
    <section id="applications" className="border-t border-line bg-bg-subtle py-20 md:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="eyebrow">Applications</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Une seule application, sur le PC.</h2>
          <p className="mt-4 text-muted">
            Tout se passe sur l'ordinateur. Le téléphone utilise ce qui est déjà intégré à iOS et à Android.
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
                  {a.status === "Bêta" ? "Bêta" : `En développement · ${a.status}`}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
