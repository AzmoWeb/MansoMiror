# État d'avancement

Règle : une ligne passe en ✅ seulement si elle est développée **et** testée.

| Élément | État | Preuve |
|---|---|---|
| Dossier d'architecture et limitations des plateformes | ✅ | `documentation/architecture.md` |
| Direction artistique | ✅ | `documentation/brand.md` |
| Logo, icône d'app, wordmark (SVG) | ✅ | `brand/` — rendu vérifié de 16 à 160 px, versions couleur et mono |
| Design tokens (TS + CSS clair/sombre/auto + reduced-motion) | ✅ | `packages/design-tokens` — 9 tests, contraste WCAG AA vérifié |
| Composants UI partagés (`packages/ui`) | ⏳ | phase 1 (suite) / 2 |
| Site web | ⏳ | phase 2 |
| Desktop, mobile, backend, admin | ⏳ | phases 3 à 6 |

Rien n'est encore téléchargeable : aucun binaire n'a été compilé ni publié.
