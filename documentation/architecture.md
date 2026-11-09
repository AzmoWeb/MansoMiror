# MansoMirror — Dossier d'architecture

Statut : **Phase 1 (conception)**. Ce document fixe les décisions techniques. Toute fonctionnalité
listée ici est *prévue*, pas *disponible*, tant qu'elle n'apparaît pas comme validée dans
[`status.md`](./status.md).

---

## 1. Analyse du cahier des charges

Le projet contient cinq produits (Web, Desktop, Mobile, Backend, Admin). Sa difficulté ne vient
pas de l'interface : elle vient de **la capture d'écran native, de l'encodage vidéo à faible
latence, du transport pair-à-pair et de l'injection d'entrées**. Ces quatre briques dépendent
fortement de chaque système, et ce sont elles qui fixent le planning.

### Difficultés techniques identifiées

| # | Difficulté | Pourquoi c'est dur | Réponse retenue |
|---|---|---|---|
| D1 | Latence de bout en bout < 100 ms en LAN | Capture → encodage → réseau → décodage → affichage, chaque étape ajoute 5–30 ms | Encodage matériel (MediaCodec, VideoToolbox, Media Foundation), H.264 baseline/low-latency, WebRTC sans buffer de lecture |
| D2 | Contrôle à distance d'Android | Android interdit l'injection d'entrées à une app tierce, sauf via un service d'accessibilité (contrôlé par Google Play) ou via ADB | **USB/ADB** depuis le desktop (approche « serveur ADB ») en priorité ; service d'accessibilité en option, documenté et soumis à l'accord explicite de l'utilisateur |
| D3 | Contrôle à distance d'iOS | **Impossible** pour une app tierce : iOS n'expose aucune API d'injection d'entrées | Non proposé. iOS → ordinateur reste en **lecture seule** |
| D4 | Capture d'écran iOS | Uniquement via ReplayKit Broadcast Upload Extension, avec une limite mémoire stricte (~50 Mo) pour l'extension | Extension dédiée qui encode en H.264 via VideoToolbox et envoie au desktop ; aucun décodage dans l'extension |
| D5 | Recopie iPhone par câble | La recopie USB native passe par des protocoles Apple (AirPlay, CoreMediaIO) non documentés pour un usage tiers | Phase 1 : Wi-Fi uniquement pour iOS. USB iOS à étudier plus tard (CoreMediaIO sur macOS uniquement), sans promesse |
| D6 | Traversée NAT hors LAN | Près de 10–20 % des connexions nécessitent un relais | STUN public + coturn auto-hébergé (TURN/TLS 443), avec des identifiants TURN temporaires (HMAC) |
| D7 | Découverte locale | mDNS bloqué sur certains réseaux (entreprise, Wi-Fi invité, isolation client) | mDNS d'abord, puis repli sur l'appairage QR/PIN via le serveur de signalisation |
| D8 | Sécurité de l'appairage | Un PIN à 6 chiffres peut être deviné par force brute | PIN à usage unique, valable 120 s, 5 tentatives max puis blocage ; échange authentifié (SPAKE2) ; empreinte DTLS vérifiée |
| D9 | Distribution | Signature de code Windows (certificat), notarisation macOS, revue App Store (extension de broadcast) | Pipeline CI de signature en phase 8 ; budget pour les certificats à prévoir |

## 2. Architecture technique

```
                  ┌──────────────────────── Internet (optionnel) ───────────────────────┐
                  │   services/api (REST)   services/signaling (WSS)   coturn (TURN/STUN)│
                  │        │  PostgreSQL         │  Redis (présence, pub/sub)            │
                  └────────┼─────────────────────┼───────────────────────────────────────┘
                           │ auth, appareils,    │ offres/réponses SDP, ICE,
                           │ historique          │ invitations, révocations
   ┌───────────────────────┴───┐            ┌────┴──────────────────────┐
   │ Desktop (Electron)        │◀══ WebRTC ═▶│ Mobile (RN + modules natifs)│
   │ capture · encodage · rendu│  DTLS-SRTP  │ capture · encodage          │
   │ injection d'entrées       │  P2P / TURN │ (Android : entrées via ADB) │
   └───────────────────────────┘            └─────────────────────────────┘
          ▲  USB : ADB (Android) — transport local, sans serveur
          ▲  LAN : mDNS `_mansomirror._tcp` + signalisation locale embarquée dans le desktop
```

Principes :

1. **Le flux vidéo ne passe jamais par l'API.** Il circule en pair-à-pair (WebRTC) ou, en dernier
   recours, par TURN, qui relaie des paquets chiffrés qu'il ne peut pas lire.
2. **Fonctionnement sans Internet** : en LAN et en USB, le desktop embarque un mini-serveur de
   signalisation local. Le compte et le cloud servent à la synchronisation et à la connexion à distance,
   jamais à l'usage de base.
3. **Consentement obligatoire** : chaque session demande une acceptation sur l'appareil partagé,
   sauf pour un appareil déjà marqué « de confiance ». Le bouton « Tout couper » ferme toutes les
   connexions (pairs WebRTC, sockets, ADB) en une action.

## 3. Technologies retenues

| Produit | Choix | Justification |
|---|---|---|
| **Web** | Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion | SSG pour le SEO et les performances, conforme au cahier des charges |
| **Desktop** | **Electron** + React/TypeScript (choix du porteur du projet ; Tauri 2 avait été évalué en premier) | Un seul code pour Windows, macOS et Linux ; WebRTC et capture d'écran fournis par Chromium (`desktopCapturer`). Contreparties : application plus lourde (~100–125 Mo) et modules natifs nécessaires pour le contrôle à distance |
| **Mobile** | React Native (New Architecture) + **modules natifs** Kotlin/Swift | L'UI, la navigation et l'appairage sont en RN ; capture, encodage et WebRTC restent natifs (MediaProjection + MediaCodec ; ReplayKit + VideoToolbox) |
| **API** | Node.js + TypeScript + Fastify + Drizzle ORM + PostgreSQL 16 | Typage partagé avec le front, migrations SQL versionnées |
| **Signalisation** | Node.js + `ws` + Redis pub/sub | Scalable horizontalement, la présence est stockée dans Redis avec un TTL |
| **Média** | coturn | Le TURN standard de l'industrie. Pas de SFU en v1 (le multi-appareils 1→N passe par plusieurs pairs) ; LiveKit/mediasoup sera évalué au-delà de 3 spectateurs |
| **Admin** | Next.js séparé, déployé sur un domaine distinct, SSO + WebAuthn obligatoire | L'admin ne doit jamais partager le bundle public |
| **Outillage** | pnpm workspaces + Turborepo, Vitest/`node:test`, Playwright, GitHub Actions | |

Encodage : enregistrement côté récepteur via FFmpeg (desktop) en MP4 H.264, **local uniquement**.
Aucun flux n'est stocké côté serveur.

## 4. Limitations par plateforme

### Android
- Capture : `MediaProjection`, avec une boîte de dialogue système obligatoire **à chaque session**
  (Android 14+ : jeton à usage unique ; un service de premier plan de type `mediaProjection` est obligatoire).
- Android 14+ peut ne capturer qu'une seule app si l'utilisateur le choisit (partage d'une seule application).
- Audio interne : `AudioPlaybackCapture` (Android 10+) uniquement, et les apps peuvent refuser la capture.
- Contrôle : pas d'injection sans ADB ou sans service d'accessibilité. Les règles de Google Play limitent
  `AccessibilityService` aux apps dont c'est la fonction principale, ce qui impose une déclaration et un risque de rejet.
- Les contenus `FLAG_SECURE` (banques, DRM) apparaissent en noir. **Normal, et à ne pas contourner.**

### iOS / iPadOS
- Capture système : ReplayKit Broadcast Upload Extension, démarrée par l'utilisateur depuis le Centre de contrôle
  ou un `RPSystemBroadcastPickerView`. Elle ne peut pas démarrer automatiquement.
- Mémoire de l'extension limitée (~50 Mo) : encodage matériel et envoi immédiat, sans tampon.
- **Aucun contrôle à distance possible.** Aucune découverte en arrière-plan : il faut l'app ouverte
  et la permission « Réseau local » (iOS 14+).
- Les contenus protégés (DRM) sont exclus de la capture.

### Windows
- Capture : Windows.Graphics.Capture (Windows 10 1903+), DXGI en repli. Une bordure jaune peut apparaître
  sur les anciennes versions.
- L'injection d'entrées (`SendInput`) ne fonctionne pas sur les fenêtres élevées (UAC) si l'app ne l'est pas.
- Le pilote ADB USB est nécessaire pour certains Android : l'installeur doit l'expliquer.
- SmartScreen : sans signature EV, l'app affichera un avertissement au début.

### macOS
- Capture : ScreenCaptureKit (macOS 12.3+), avec la permission « Enregistrement de l'écran » ; macOS 15 la
  redemande périodiquement.
- Contrôle de ce Mac depuis un téléphone : permission « Accessibilité » obligatoire.
- Distribution : signature Developer ID + notarisation obligatoires.

## 5. Organisation du monorepo

Cible (les dossiers sont créés **au moment où leur code existe**, pas avant) :

```
mansomirror/
├── apps/
│   ├── web/              Next.js — site officiel            (phase 2)
│   ├── desktop/          Tauri 2 : src-tauri/ (Rust) + ui/  (phase 3)
│   ├── mobile/           React Native + modules natifs      (phases 4–5)
│   └── admin/            Next.js privé                      (phase 6+)
├── services/
│   ├── api/              Fastify + Drizzle                  (phase 6)
│   └── signaling/        WebSocket + Redis                  (phase 6)
├── packages/
│   ├── design-tokens/    ✅ couleurs, typo, motion → TS + CSS (phase 1)
│   ├── ui/               composants React partagés web/desktop/admin
│   ├── protocol/         types + schémas (zod) des messages de signalisation
│   └── config/           tsconfig, eslint, tailwind preset
├── infrastructure/
│   ├── docker/  database/ (migrations)  coturn/
├── brand/                ✅ logo, icône, wordmark (phase 1)
├── documentation/        ✅
└── pnpm-workspace.yaml   ✅
```

## 6. Modèle de données (aperçu, phase 6)

- `users` (id, email unique, password_hash argon2id, created_at, mfa_enabled)
- `devices` (id, user_id FK, platform enum, name, public_key, last_seen_at) — index (user_id)
- `trusted_devices` (device_id, trusted_device_id, granted_at, revoked_at) — unique (paire)
- `device_sessions` (id, host_device_id, viewer_device_id, mode enum[mirror|control], transport enum[lan|p2p|turn|usb], started_at, ended_at, end_reason)
- `connection_history` : vue / table d'événements dérivée de `device_sessions`
- `user_settings` (user_id PK, theme, motion, default_quality, default_fps, auto_reconnect)
- `authentication_sessions` (id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at)

## 7. Sécurité (principes)

- Mots de passe : argon2id. Jetons d'accès courts (15 min) et refresh tokens rotatifs avec détection de réutilisation.
- Appairage : chaque appareil possède une paire de clés générée localement (Ed25519), dont la clé privée
  ne quitte jamais l'appareil (Keychain / Keystore / DPAPI). L'appairage QR/PIN échange les clés publiques
  via SPAKE2. Ensuite, l'empreinte DTLS de WebRTC est signée par la clé de l'appareil, ce qui empêche
  l'attaque de l'homme du milieu au niveau de la signalisation.
- Limitation de débit : Redis (sliding window) par IP et par compte ; 5 tentatives de PIN au maximum.
- Journal d'audit : appairage, révocation, session ouverte/fermée, connexions admin.
- Secrets : variables d'environnement injectées par l'orchestrateur, jamais commitées ; `.env.example` uniquement.

## 8. Étapes de développement

| Phase | Livrable | Critère de sortie |
|---|---|---|
| 1 | Identité, tokens, architecture | ✅ tokens testés (contraste AA), logo, présent document |
| 2 | Site web | Lighthouse ≥ 95, responsive testé (Playwright), aucun téléchargement fictif |
| 3 | Desktop | Recopie **Android → PC en USB/ADB** de bout en bout (la plus faisable), puis Wi-Fi |
| 4 | Android | Capture MediaProjection → WebRTC vers le desktop en LAN |
| 5 | iOS | Extension ReplayKit → desktop en lecture seule |
| 6 | Backend | Comptes, appareils, signalisation distante, TURN |
| 7 | Sécurité / perf | Audit, tests de coupure réseau, mesures de latence/CPU/RAM sur appareils physiques |
| 8 | Publication | Installeurs signés, notarisation, stores |

**Note :** la phase 3 est placée avant le backend parce que le cas d'usage principal (téléphone → PC
sur le même réseau ou en USB) ne nécessite pas de cloud.
