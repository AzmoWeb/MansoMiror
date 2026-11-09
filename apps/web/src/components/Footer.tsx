import Link from "next/link";
import { Logo } from "./Logo";
import { nav, docsUrl, supportUrl, githubUrl } from "@/content/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Recopie d'écran et contrôle à distance entre vos téléphones et vos ordinateurs. Your screen. Everywhere. Seamlessly.
          </p>
        </div>
        <nav aria-label="Navigation du pied de page">
          <p className="text-sm font-semibold">Produit</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {nav.map((n) => (
              <li key={n.href}><Link href={n.href} className="hover:text-ink">{n.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold">Ressources</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/#telecharger" className="hover:text-ink">Téléchargements</Link></li>
            <li><a href={docsUrl} className="hover:text-ink">Documentation</a></li>
            <li><a href={supportUrl} className="hover:text-ink">Assistance</a></li>
            <li><a href={githubUrl} className="hover:text-ink">GitHub</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Légal</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link></li>
            <li><Link href="/conditions" className="hover:text-ink">Conditions d'utilisation</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col justify-between gap-2 py-6 text-xs text-subtle sm:flex-row">
          <p>© {new Date().getFullYear()} MansoMirror. Tous droits réservés.</p>
          <p>Made with care by Manso.</p>
        </div>
      </div>
    </footer>
  );
}
