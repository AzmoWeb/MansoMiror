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
| Desktop, mobile, backend, admin | ⏳ | phases 3 à 6 |

Rien n'est encore téléchargeable : aucun binaire n'a été compilé ni publié. La section Téléchargements du site
lit `apps/web/src/content/releases.ts`, qui est vide ; elle affiche donc « Pas encore disponible ».
La démo du site est une **maquette** clairement signalée comme telle : aucun appareil n'y est connecté.
