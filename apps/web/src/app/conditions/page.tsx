import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Page() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="9 novembre 2026">
      <p>
        MansoMirror n'est pas encore disponible. Les conditions définitives seront publiées avec la première version et relues
        juridiquement au préalable.
      </p>
      <h2>Usage autorisé</h2>
      <p>
        MansoMirror sert à afficher et contrôler vos propres appareils, ou ceux dont le propriétaire a donné son accord. Toute
        utilisation visant à accéder à un appareil sans autorisation est interdite.
      </p>
      <h2>Limites des plateformes</h2>
      <p>
        Certaines fonctionnalités dépendent des autorisations accordées par Android, iOS, Windows et macOS. MansoMirror respecte ces
        mécanismes et ne cherche jamais à les contourner.
      </p>
    </LegalPage>
  );
}
