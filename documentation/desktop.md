# MansoMirror Desktop

Application Electron pour **Windows, macOS et Linux** : partage d'écran entre deux ordinateurs du même réseau local.

## Ce que fait la version 0.1 (testé)

| Fonction | État | Comment c'est vérifié |
|---|---|---|
| Choisir l'écran (ou la fenêtre) à partager | ✅ | e2e : deux instances réelles sous Xvfb |
| Code à 6 chiffres, usage unique, valable 2 min, 5 essais max | ✅ | tests unitaires + e2e |
| Accord explicite avant toute session (refus auto après 30 s) | ✅ | tests unitaires + e2e |
| Vidéo en direct (WebRTC, chiffrée DTLS-SRTP, pair-à-pair) | ✅ | e2e : l'autre instance reçoit une vidéo réelle (1440×900, ~30 i/s) |
| Statistiques mesurées (résolution, i/s, débit, latence, pertes) | ✅ | e2e |
| Découverte automatique sur le réseau (mDNS) + saisie d'adresse | ✅ | e2e (mDNS testé en local ; réseaux filtrés : saisie manuelle) |
| « Tout couper » (bouton + Ctrl+Alt+K) | ✅ | e2e : coupe la session des deux côtés |
| Capture d'écran PNG, enregistrement WebM local | ✅ / ⚠️ | l'avertissement d'enregistrement à l'autre ordinateur est testé en e2e ; la sauvegarde du fichier passe par une boîte de dialogue système, testée à la main seulement |
| Historique des sessions, paramètres (nom, thème, qualité, port) | ✅ | e2e (historique) |
| Paquets Linux AppImage et .deb | ✅ | compilés et lancés (interface vérifiée) |
| Installeur Windows `.exe` et `.dmg` macOS | ⏳ | compilés par GitHub Actions sur de vrais Windows/Mac ; **pas encore testés sur une machine réelle** |

## Ce qu'elle ne fait pas encore

- **Recopier un téléphone** : cela demande l'application mobile (phases 4–5).
- **Contrôler l'ordinateur distant** (souris/clavier) : nécessite un module natif d'injection d'entrées et une autorisation système (Accessibilité sur macOS). Prévu.
- **Son** : la capture du son système n'est possible simplement que sous Windows. Prévue.
- **Connexion hors réseau local** : nécessite le serveur de signalisation et TURN (phase 6).
- **Appareils de confiance / reconnexion sans code** : prévu ; aujourd'hui chaque session exige un nouveau code.
- **Wayland (Linux)** : la capture passe par PipeWire et n'a pas été testée ; utiliser une session X11.

## Sécurité

**Appairage** (`src/main/host.ts`, `src/main/viewer.ts`, protocole décrit dans `src/shared/protocol.ts`) :

1. L'ordinateur qui partage affiche un code (`crypto.randomInt`) et un sel aléatoire neuf.
2. L'ordinateur qui regarde dérive une clé `scrypt(code, sel)` et envoie son offre WebRTC accompagnée d'un HMAC.
3. Si le HMAC est faux, l'essai est compté ; au 5ᵉ, le code est bloqué. L'utilisateur n'est jamais dérangé par un mauvais code.
4. Si le HMAC est bon, le code est consommé, puis l'utilisateur doit **autoriser** la connexion.
5. La réponse WebRTC est elle aussi signée : l'ordinateur qui regarde vérifie que l'autre connaît le code.

Les deux offres WebRTC contiennent les empreintes DTLS de la connexion : les signer avec la clé dérivée du code
empêche une attaque de l'homme du milieu sur le réseau local. Le flux vidéo va directement d'un ordinateur à l'autre.

**Limite connue** : le code ne fait que 6 chiffres. Un attaquant qui *enregistre* l'échange peut tenter de retrouver le code
hors ligne (10⁶ essais scrypt, plusieurs heures sur un processeur). Comme le code est à usage unique et expire en 2 minutes,
cela ne lui donne pas accès à la session. Un échange PAKE (SPAKE2) supprimera cette possibilité ; il est prévu.

**Electron** (`src/main/main.ts`) :

- `contextIsolation`, `sandbox` (processus et fenêtre), pas de `nodeIntegration` ; l'interface ne voit que `window.mm` (24 fonctions).
- Interface servie par un protocole privé `app://` avec une CSP stricte (pas de script en ligne, aucune connexion réseau depuis la page).
- Navigation, fenêtres pop-up et `<webview>` bloquées. Chaque appel IPC vérifie l'expéditeur et valide ses arguments.
- Autorisations : seule la capture d'écran est accordée, et uniquement à notre page, pour la source choisie par l'utilisateur.
- *Fuses* Electron : `RunAsNode`, `NODE_OPTIONS` et `--inspect` désactivés, intégrité de l'archive asar vérifiée.
- L'option `--no-sandbox` n'existe que pour lancer les tests en root dans un conteneur.

**Réseau** : l'ordinateur qui partage n'écoute (port TCP 47800 par défaut) que pendant un partage. Le pare-feu peut demander une autorisation.

## Développer

```bash
pnpm install
pnpm --filter @mansomirror/desktop test       # 16 tests : appairage, protocole, échanges réseau réels
pnpm --filter @mansomirror/desktop typecheck
pnpm --filter @mansomirror/desktop build
pnpm --filter @mansomirror/desktop exec electron .
```

Test de bout en bout (Linux, nécessite Xvfb) :

```bash
xvfb-run -a -s "-screen 0 1440x900x24" pnpm --filter @mansomirror/desktop test:e2e
```

## Compiler les installeurs

```bash
pnpm --filter @mansomirror/desktop dist --linux   # AppImage + .deb (sur Linux)
pnpm --filter @mansomirror/desktop dist --win     # .exe NSIS (sur Windows)
pnpm --filter @mansomirror/desktop dist --mac     # .dmg (sur macOS)
```

Publication : pousser un tag `desktop-vX.Y.Z[-beta.N]` déclenche `.github/workflows/release-desktop.yml`, qui compile sur
Windows, macOS et Linux et publie une pré-version GitHub avec `SHA256SUMS.txt`. Ensuite, ajouter les fichiers à
`apps/web/src/content/releases.ts` pour qu'ils apparaissent sur le site.

**Signature** : aucune pour l'instant. Pour la supprimer les avertissements :
- Windows : certificat de signature de code (OV ou EV) → variables `CSC_LINK` / `CSC_KEY_PASSWORD` dans les secrets GitHub ;
- macOS : compte Apple Developer (99 $/an), certificat *Developer ID Application* et notarisation.
