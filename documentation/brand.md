# MansoMirror — Direction artistique

## Idée

Un miroir **précis**, pas magique. MansoMirror est un outil : l'identité évoque la netteté d'un
instrument (axes, alignements, reflets) plutôt que l'esthétique « IA / néon / gradient violet ».

## Logo

`brand/logo-mark.svg` — un **M** tracé en un seul geste puis réfléchi autour d'un axe vertical fin.
La moitié gauche (blanche) est l'appareil source ; la moitié droite (vert d'eau clair) est son
reflet ; l'axe central est le lien entre les deux. Le motif reste lisible à 16 px.

| Fichier | Usage |
|---|---|
| `brand/app-icon.svg` | Icône d'application (1024 px, léger dégradé vertical) |
| `brand/logo-mark.svg` | Favicon, barre latérale, notifications |
| `brand/logo-mark-mono.svg` | Une seule couleur (`currentColor`) : barre de menus macOS, zone de notification Windows, filigranes |
| `brand/wordmark.svg` | En-tête du site, documents. ⚠️ Vectoriser le texte avant tout usage imprimé ou dans les stores |

Zone de protection : ¼ de la largeur du symbole tout autour. Ne jamais incliner, ombrer ou recolorer
le symbole en dehors des couleurs de la palette.

## Couleurs

Source unique : `packages/design-tokens/src/tokens.ts`.

- **Lagoon** (`#0A6A5A` en clair, `#2CBFA2` en sombre) : couleur de marque. Un sarcelle profond,
  rarement utilisé dans ce marché (où dominent bleus et violets).
- **Graphite** : neutres légèrement chauds. Fond blanc ou `#111110` ; aucun noir pur.
- **Signal** (`#F2552F`) : réservé à l'état « en direct / enregistrement » et aux actions destructives.
  Il ne sert jamais à la décoration : quand il apparaît, c'est que quelque chose est transmis.

Tous les couples texte/fond sont **vérifiés automatiquement** (WCAG AA, 4.5:1 pour le texte et 3:1 pour
les éléments d'interface) par `pnpm --filter @mansomirror/design-tokens test`.

## Typographie

- **Manrope** : titres et chiffres d'affichage.
- **Inter** : interface et texte courant.
- **JetBrains Mono** : codes PIN, adresses IP, latence et débit. Les données techniques sont toujours en
  chasse fixe, pour qu'elles ne « sautent » pas quand elles changent en temps réel.

## Forme

- Bordures fines (1 px `border`), ombres discrètes (`shadow.md` maximum pour les surfaces au repos).
- Rayons : 6 px pour les contrôles, 10 px pour les panneaux, 14 px pour les fenêtres et cadres d'appareil ;
  forme de pilule uniquement pour les badges d'état.
- Grille de 4 px.

## Mouvement

- Durées : 120 / 200 / 320 ms ; ressort pour les micro-interactions.
- **Signature** : à la connexion, l'axe du logo « s'ouvre » et l'écran distant apparaît par un balayage
  horizontal depuis l'axe, comme un reflet qui se forme. À la déconnexion, le mouvement inverse.
- Indicateur « en direct » : un point Signal qui pulse **uniquement** lorsqu'un flux est actif.
- `prefers-reduced-motion` ramène toutes les durées à 0 (géré dans le CSS généré) ; les apps React
  utilisent `useReducedMotion()` de Framer Motion.

## Composition (à l'opposé des pages « générées »)

- Pas de grille de cartes identiques. Les fonctionnalités sont présentées **dans le produit** (vue
  annotée de la fenêtre desktop) plutôt qu'en icône + titre + paragraphe répétés.
- Des sections asymétriques, beaucoup d'air, une seule idée par écran.
- Les illustrations montrent de vrais états de l'interface MansoMirror, jamais des formes abstraites.
