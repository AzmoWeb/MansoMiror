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

## Afficher et contrôler un Android (dans la fenêtre MansoMirror)

Panneau « Afficher et contrôler un Android » : le téléphone branché en USB (ou connecté en Wi-Fi, Android 11+) apparaît
dans la liste ; « Afficher » montre son écran **en grand dans la fenêtre MansoMirror**, et la souris/le clavier le pilotent.

- Le téléphone exécute **scrcpy-server 3.3.1** (Genymobile, Apache-2.0), envoyé par adb au début de la session et
  supprimé à la fin. Le flux H.264 passe par un tunnel adb local ; il est décodé dans l'application (WebCodecs,
  accéléré par la carte graphique quand c'est possible) et affiché sur un canevas.
- Contrôle : clic = toucher, glisser = balayer, molette = défiler, clic droit/Échap = Retour, clic molette = Accueil,
  clavier = saisie de texte ; barre Android (Retour, Accueil, Récents), volume, marche, capture, mode lecture seule.
  L'interface n'envoie que des actions décrites, validées par le processus principal (aucun octet brut).
- Sécurité : Android impose lui-même l'activation du débogage USB/sans fil et l'acceptation de l'ordinateur sur le
  téléphone. « Tout couper » arrête la session.
- Composants livrés : scrcpy-server 3.3.1 (toutes plateformes) et adb (Windows), téléchargés à la compilation par
  `scripts/fetch-scrcpy.mjs` avec empreintes SHA-256 figées. macOS/Linux : adb à installer
  (`brew install android-platform-tools`, `sudo apt install adb`).
- Testé : protocole vérifié contre le code source de scrcpy 3.3.1 (messages au bit près), session et interface testées
  avec un faux téléphone qui parle le même protocole et envoie une vraie vidéo H.264 (décodage, résolution,
  coordonnées du clic, boutons, saisie, lecture seule). **Pas encore testé avec un vrai téléphone Android.**

## Recevoir un iPhone ou un iPad (AirPlay)

Le panneau « Recevoir un iPhone ou un iPad » transforme l'ordinateur en récepteur **AirPlay** : sur l'iPhone, Centre de
contrôle → **Recopie de l'écran** → choisir « *nom de l'ordinateur* · MansoMirror » → saisir le code à 4 chiffres affiché.

- Récepteur : [UxPlay](https://github.com/FDH2/UxPlay) (open source, **GPL-3.0**), lancé comme programme séparé
  (`src/main/airplay.ts`). Il affiche l'écran de l'iPhone dans sa propre fenêtre.
- Sécurité : code à 4 chiffres tiré au hasard à chaque activation ; la réception s'arrête avec « Tout couper ».
- Testé : l'ordinateur s'annonce bien sur le réseau comme récepteur AirPlay (`_airplay._tcp`) sous le bon nom
  (test automatique avec le vrai UxPlay). **Pas encore testé avec un vrai iPhone** (aucun iPhone dans l'environnement de test).
- **Windows : UxPlay 1.74 est inclus dans l'installeur** (compilé par le workflow de publication avec MSYS2, avec les
  modules GStreamer nécessaires ; sa découverte réseau intégrée rend Bonjour inutile). Au premier lancement, autorisez
  `uxplay.exe` dans le pare-feu Windows (réseaux privés).
- Linux : `sudo apt install uxplay gstreamer1.0-plugins-bad gstreamer1.0-libav` ; macOS : `brew install uxplay`.
- AirPlay est un protocole Apple non documenté publiquement : UxPlay en est une réimplémentation ; une mise à jour d'iOS
  peut nécessiter une mise à jour d'UxPlay. Distribuer UxPlay avec l'application impose de fournir son code source (GPL-3.0).

## Mises à jour automatiques

Windows (installeur) et Linux (AppImage) : MansoMirror vérifie au démarrage puis toutes les heures
(réglage « Mises à jour » dans les paramètres). La nouvelle version est téléchargée en arrière-plan, son empreinte
SHA-512 est vérifiée, puis elle s'installe à la fermeture de l'application ou immédiatement avec « Redémarrer ».

- Flux : `https://azmoweb.github.io/MansoMiror/updates/latest.yml` (Windows) et `latest-linux.yml`, republiés par le
  site à partir de la dernière version GitHub (les fichiers restent hébergés sur GitHub Releases).
- macOS : pas encore (une application signée est nécessaire) ; téléchargement manuel depuis le site.
- Les versions 0.1 et 0.2 n'avaient pas cette fonction : installez la 0.3 une fois à la main, les suivantes arriveront seules.

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

Publication, au choix :
- onglet **Actions** → **Release desktop** → **Run workflow**, version `X.Y.Z[-beta.N]`, case **publish** cochée ;
- ou pousser un tag `desktop-vX.Y.Z[-beta.N]`.

Le workflow compile sur de vrais Windows, macOS et Linux, publie une pré-version GitHub avec `SHA256SUMS.txt`, puis
relance la mise en ligne du site. Au moment de sa construction, le site lit la dernière version publiée
(`apps/web/scripts/fetch-releases.ts`) : seuls les fichiers dont l'empreinte figure dans `SHA256SUMS.txt` sont proposés.

**Signature** : aucune pour l'instant. Pour la supprimer les avertissements :
- Windows : certificat de signature de code (OV ou EV) → variables `CSC_LINK` / `CSC_KEY_PASSWORD` dans les secrets GitHub ;
- macOS : compte Apple Developer (99 $/an), certificat *Developer ID Application* et notarisation.
