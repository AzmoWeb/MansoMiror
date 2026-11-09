import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Confidentialité" };

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité" updated="9 novembre 2026">
      <p>
        MansoMirror est en cours de développement et aucune application n'est encore distribuée. Ce document décrit les principes
        qui guident sa conception ; il sera complété et relu juridiquement avant la première version publique.
      </p>
      <h2>Ce site</h2>
      <p>Ce site n'utilise ni cookie publicitaire, ni outil de suivi. Votre préférence de thème est enregistrée uniquement dans votre navigateur.</p>
      <h2>Les flux d'écran</h2>
      <p>
        Les images de votre écran vont directement d'un appareil à l'autre, chiffrées de bout en bout. Elles ne sont ni stockées ni
        analysées sur nos serveurs. Lorsqu'un relais est nécessaire pour traverser un réseau, il transmet des paquets chiffrés qu'il ne peut pas lire.
      </p>
      <h2>Consentement</h2>
      <p>
        Aucune session ne peut démarrer sans votre accord sur l'appareil partagé. Vous pouvez interrompre toutes les connexions à tout
        moment et révoquer un appareil de confiance.
      </p>
      <h2>Enregistrements</h2>
      <p>Les enregistrements et captures sont créés à votre demande et sauvegardés uniquement sur votre appareil.</p>
      <h2>Compte (optionnel)</h2>
      <p>
        Un compte ne sera nécessaire que pour la connexion à distance. Il contiendra votre adresse e-mail, la liste de vos appareils et
        l'historique de vos sessions (dates, appareils, durée), sans aucun contenu d'écran. Vous pourrez le supprimer à tout moment.
      </p>
    </LegalPage>
  );
}
