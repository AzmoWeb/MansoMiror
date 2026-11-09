<p align="center"><img src="brand/app-icon.svg" width="96" alt="MansoMirror"></p>

# MansoMirror

**Your screen. Everywhere. Seamlessly.**
Écosystème de recopie d'écran et de contrôle à distance : Web, Desktop (Windows/macOS), Mobile (Android/iOS), Backend, Admin.

> **État** : site web et application desktop (bêta : partage d'écran entre ordinateurs sur le réseau local).
> L'application mobile, le serveur et l'administration ne sont pas encore développés.
> Voir [`documentation/status.md`](documentation/status.md) pour l'état réel de chaque fonctionnalité.

## Documentation

- [Architecture, technologies, limitations des plateformes, feuille de route](documentation/architecture.md)
- [Application desktop : fonctions, sécurité, compilation](documentation/desktop.md)
- [Direction artistique](documentation/brand.md)
- [État d'avancement](documentation/status.md)

## Développement

Prérequis : Node.js ≥ 22.18, pnpm 10.

```bash
pnpm install
pnpm test                          # tests unitaires de tous les paquets
pnpm build                         # tokens CSS + build de production du site
pnpm test:e2e                      # tests navigateur du site (après pnpm build)
pnpm --filter @mansomirror/web dev # site en local sur http://localhost:3000
```

## Structure actuelle

```
apps/web/                 site officiel (Next.js, Tailwind CSS, Motion)
apps/desktop/             application Windows / macOS / Linux (Electron, React, WebRTC)
brand/                    logo, icône d'app, wordmark
documentation/            architecture, charte, état
packages/design-tokens/   couleurs, typographie, espacements, motion (TS + CSS)
```

---
Made with care by Manso.
