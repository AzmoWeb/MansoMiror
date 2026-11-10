export const githubUrl = "https://github.com/AzmoWeb/MansoMiror";
export const docsUrl = `${githubUrl}/tree/main/documentation`;
export const supportUrl = `${githubUrl}/issues`;

export const nav = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#applications", label: "Applications" },
  { href: "/#compatibilite", label: "Compatibilité" },
  { href: "/#fonctionnement", label: "Comment ça marche ?" },
  { href: "/#faq", label: "FAQ" },
] as const;

/** Feature ids double as anchors into the annotated product view. */
export type FeatureId = "mirror" | "iphone" | "android" | "control" | "sound" | "quality" | "screenshot" | "record";

export const features: { id: FeatureId; title: string; body: string }[] = [
  {
    id: "mirror",
    title: "Le téléphone en grand sur le PC",
    body: "L'écran du téléphone s'affiche dans la fenêtre MansoMirror, en grand ou en plein écran, en temps réel.",
  },
  {
    id: "iphone",
    title: "iPhone et iPad, sans rien installer",
    body: "Sur l'iPhone : Centre de contrôle, « Recopie de l'écran », choisissez votre PC et saisissez le code affiché. C'est tout.",
  },
  {
    id: "android",
    title: "Android en USB ou en Wi-Fi",
    body: "Branchez le câble (ou activez le débogage sans fil sur Android 11+) : le téléphone apparaît dans la liste, un clic suffit.",
  },
  {
    id: "control",
    title: "Contrôle d'Android à la souris",
    body: "Cliquez, glissez, faites défiler et tapez au clavier sur l'écran du téléphone, directement depuis le PC.",
  },
  {
    id: "sound",
    title: "Le son sur l'ordinateur",
    body: "Le son de l'iPhone sort des haut-parleurs du PC. Pour Android, le son arrive dans une prochaine version (Android 11+).",
  },
  {
    id: "quality",
    title: "Haute qualité, faible latence",
    body: "Jusqu'à 1080p à 60 images par seconde, décodées par la carte graphique de l'ordinateur. Le flux reste sur votre réseau.",
  },
  {
    id: "screenshot",
    title: "Captures d'écran",
    body: "Une image nette de l'écran du téléphone, en pleine résolution, en un clic.",
  },
  {
    id: "record",
    title: "Enregistrement",
    body: "Enregistrez ce qui se passe sur le téléphone, directement sur votre ordinateur. Rien n'est envoyé en ligne.",
  },
];

export type Support = "available" | "planned" | "studying" | "impossible";

export const supportLabel: Record<Support, string> = {
  available: "Disponible (bêta)",
  planned: "Prévu",
  studying: "À l'étude",
  impossible: "Impossible",
};

export const compatColumns = ["iPhone / iPad", "Android"] as const;

export const compatRows: { feature: string; cells: { s: Support; note?: string }[] }[] = [
  {
    feature: "Écran du téléphone affiché sur le PC",
    cells: [
      { s: "available", note: "Via « Recopie de l'écran » (AirPlay), sur le même Wi-Fi." },
      { s: "available", note: "Débogage USB à activer une fois dans les options pour les développeurs." },
    ],
  },
  { feature: "Son sur le PC", cells: [{ s: "available" }, { s: "planned", note: "Android 11 et plus récent." }] },
  {
    feature: "Contrôle à la souris et au clavier",
    cells: [{ s: "impossible", note: "iOS n'autorise aucune application à piloter l'iPhone." }, { s: "available" }],
  },
  { feature: "Sans câble (Wi-Fi)", cells: [{ s: "available" }, { s: "available", note: "Débogage sans fil, Android 11 et plus récent." }] },
  { feature: "Par câble USB", cells: [{ s: "studying" }, { s: "available" }] },
  { feature: "Application à installer sur le téléphone", cells: [{ s: "available", note: "Aucune : tout est intégré à iOS." }, { s: "available", note: "Aucune." }] },
];

export const steps = [
  {
    title: "Installez MansoMirror sur votre PC",
    body: "Windows, macOS ou Linux. Rien à installer sur le téléphone, aucun compte à créer.",
  },
  {
    title: "Connectez le téléphone",
    body: "iPhone : Centre de contrôle → « Recopie de l'écran » → votre PC, puis le code affiché. Android : branchez le câble USB, ou passez en Wi-Fi.",
  },
  {
    title: "Profitez-en en grand",
    body: "L'écran du téléphone s'affiche dans MansoMirror, avec le son. Un bouton suffit pour tout couper.",
  },
];

export const faq = [
  {
    q: "Qu'est-ce que MansoMirror ?",
    a: "Une application pour ordinateur (Windows, macOS, Linux) qui affiche l'écran de votre iPhone, iPad ou téléphone Android en grand sur le PC, avec le son et en bonne qualité. Elle est en bêta.",
  },
  {
    q: "Faut-il installer quelque chose sur le téléphone ?",
    a: "Non. L'iPhone utilise « Recopie de l'écran », intégrée à iOS. Android utilise le débogage USB (ou sans fil), à activer une seule fois dans les options pour les développeurs.",
  },
  {
    q: "Comment connecter mon iPhone ?",
    a: "Mettez l'iPhone et le PC sur le même Wi-Fi. Dans MansoMirror, activez la réception AirPlay. Sur l'iPhone, ouvrez le Centre de contrôle, touchez « Recopie de l'écran », choisissez votre PC et saisissez le code à 4 chiffres affiché.",
  },
  {
    q: "Comment connecter mon téléphone Android ?",
    a: "Une seule fois : Paramètres → À propos → touchez 7 fois « Numéro de build », puis activez « Débogage USB » dans les options pour les développeurs. Branchez le câble, acceptez sur le téléphone : il apparaît dans MansoMirror.",
  },
  {
    q: "Y a-t-il le son ?",
    a: "Oui pour l'iPhone et l'iPad : le son sort de l'ordinateur. Pour Android, le son arrive dans une prochaine version (Android 11 et plus récent).",
  },
  {
    q: "Puis-je contrôler le téléphone depuis le PC ?",
    a: "Oui pour Android : souris et clavier. Non pour l'iPhone : Apple ne permet à aucune application de piloter un iPhone.",
  },
  {
    q: "Le logiciel fonctionne-t-il sans Internet ?",
    a: "Oui. Le téléphone et le PC communiquent directement, sur votre Wi-Fi ou par câble. Rien ne passe par nos serveurs.",
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "L'image ne quitte pas votre réseau. Une connexion iPhone exige le code affiché par MansoMirror ; Android exige votre accord sur le téléphone. Rien n'est enregistré sans votre demande, et « Tout couper » arrête tout.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Posez vos questions et signalez les problèmes sur la page GitHub du projet.",
  },
];
