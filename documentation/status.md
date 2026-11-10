# État d'avancement

Règle : une ligne passe en ✅ seulement si elle est développée **et** testée.

| Élément | État | Preuve |
|---|---|---|
| Dossier d'architecture et limitations des plateformes | ✅ | `documentation/architecture.md` |
| Direction artistique | ✅ | `documentation/brand.md` |
| Logo, icône d'app, wordmark (SVG) | ✅ | `brand/` — rendu vérifié de 16 à 160 px, versions couleur et mono |
| Design tokens (TS + CSS clair/sombre/auto + reduced-motion) | ✅ | `packages/design-tokens` — 9 tests, contraste WCAG AA vérifié |
| Site web — page d'accueil (hero, fonctionnalités, applications, étapes, démo, compatibilité, téléchargements, FAQ, footer) | ✅ | `apps/web` — 11 tests navigateur (Playwright) + 5 tests unitaires |
| Site web — thème clair/sombre/auto, menu mobile, transitions, respect de « réduire les animations » | ✅ | testés en e2e (thème persistant, pas de défilement horizontal à 375 px, contenu visible sans animation) |
| Site web — pages Confidentialité, Conditions, 404 | ✅ | textes **provisoires**, à faire relire juridiquement |
| Site web — en-têtes de sécurité HTTP | ✅ | test e2e |
| Intégration continue (GitHub Actions) | ✅ écrite | `.github/workflows/ci.yml` — pas encore vue tourner sur GitHub |
| Site web — déploiement en ligne, mesure Lighthouse | ⏳ | nécessite un hébergeur (Vercel, Netlify…) |
| Composants UI partagés (`packages/ui`) | ⏳ | à extraire du site quand le desktop en aura besoin |
| Desktop (Electron) — partage d'écran entre ordinateurs en réseau local, appairage sécurisé, consentement, « Tout couper », captures, enregistrement, historique, paramètres | ✅ | `apps/desktop` — 16 tests unitaires/réseau + 10 tests e2e avec deux instances réelles ; détail dans `documentation/desktop.md` |
| Desktop — paquets Linux (AppImage, .deb) | ✅ | compilés et lancés ici |
| Desktop — installeur Windows `.exe`, `.dmg` macOS | ⏳ | compilés par GitHub Actions ; à tester sur de vraies machines ; non signés |
| Desktop — contrôle à distance, son, appareils de confiance, connexion hors réseau local | ⏳ | prévus |
| Site — publication GitHub Pages | ⏳ | workflow prêt ; à activer dans Settings → Pages (le déploiement échoue en 404 tant que ce n'est pas fait) |
| Site — téléchargements alimentés automatiquement par les versions GitHub publiées | ✅ | `apps/web/scripts/fetch-releases.ts` — 5 tests unitaires ; rendu vérifié avec des données de test |
| Desktop — installeurs compilés sur GitHub (Windows, macOS, Linux) | ✅ | workflow « Release desktop », exécution 42705656233 |
| Desktop — version publiée | ⏳ | à lancer : Actions → Release desktop → Run workflow → « publish » |
| Desktop — recevoir un iPhone/iPad par AirPlay (« Recopie de l'écran ») via UxPlay | ✅ partiel | annonce AirPlay vérifiée sur le réseau (test réel) ; **à tester avec un vrai iPhone** ; UxPlay à installer à part (Windows : à intégrer) |
| Desktop — version 0.1.0-beta.1 publiée (Windows, macOS, Linux) | ✅ | GitHub Releases |
| Desktop — afficher et contrôler un Android dans la fenêtre MansoMirror (scrcpy-server 3.3.1) | ✅ partiel | protocole et interface testés avec un faux téléphone (vraie vidéo H.264) ; **à tester avec un vrai téléphone** |
| Desktop — affichage de l'iPhone dans la fenêtre MansoMirror (au lieu de la fenêtre UxPlay) | ⏳ | prochaine étape |
| Bluetooth (détection / appairage) | ⏳ | à faire ; la vidéo passe par Wi-Fi/USB |
| Mobile, backend, admin | ⏳ | phases 4 à 6 |

La section Téléchargements du site lit `apps/web/src/content/releases.ts`. Seuls des fichiers réellement publiés sur
GitHub, avec leur empreinte SHA-256, peuvent y figurer.
La démo du site est une **maquette** clairement signalée comme telle : aucun appareil n'y est connecté.
