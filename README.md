<p align="center"><img src="brand/app-icon.svg" width="96" alt="MansoMirror"></p>

# MansoMirror

**Your screen. Everywhere. Seamlessly.**
Écosystème de recopie d'écran et de contrôle à distance : Web, Desktop (Windows/macOS), Mobile (Android/iOS), Backend, Admin.

> ⚠️ Projet en **phase 1 (conception et identité)**. Aucune application n'est encore disponible au téléchargement.
> Voir [`documentation/status.md`](documentation/status.md) pour l'état réel de chaque fonctionnalité.

## Documentation

- [Architecture, technologies, limitations des plateformes, feuille de route](documentation/architecture.md)
- [Direction artistique](documentation/brand.md)
- [État d'avancement](documentation/status.md)

## Développement

Prérequis : Node.js ≥ 22.18, pnpm 10.

```bash
pnpm install
pnpm test     # tests de tous les paquets
pnpm build    # génère packages/design-tokens/dist/tokens.css
```

## Structure actuelle

```
brand/                    logo, icône d'app, wordmark
documentation/            architecture, charte, état
packages/design-tokens/   couleurs, typographie, espacements, motion (TS + CSS)
```

---
Made with care by Manso.
