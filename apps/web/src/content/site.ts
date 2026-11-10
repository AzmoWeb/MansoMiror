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
export type FeatureId = "mirror" | "wifi" | "usb" | "control" | "record" | "screenshot" | "multi" | "bidirectional";

export const features: { id: FeatureId; title: string; body: string }[] = [
  {
    id: "mirror",
    title: "Duplication en temps réel",
    body: "L'écran du téléphone s'affiche dans une fenêtre redimensionnable, encodé par la puce vidéo de l'appareil pour garder une latence basse.",
  },
  {
    id: "wifi",
    title: "Connexion Wi-Fi",
    body: "Les appareils d'un même réseau se trouvent automatiquement. Le flux va directement de l'un à l'autre, sans passer par nos serveurs.",
  },
  {
    id: "usb",
    title: "Connexion USB",
    body: "Branchez un Android : la connexion par câble offre la latence la plus faible et fonctionne sans aucun réseau.",
  },
  {
    id: "control",
    title: "Contrôle à distance",
    body: "Cliquez et tapez sur l'écran recopié pour piloter le téléphone, lorsque le système le permet (Android via USB).",
  },
  {
    id: "record",
    title: "Enregistrement vidéo",
    body: "Enregistrez la session en MP4, directement sur votre ordinateur. Rien n'est stocké en ligne.",
  },
  {
    id: "screenshot",
    title: "Captures d'écran",
    body: "Une image nette de l'écran recopié, en pleine résolution, en un clic ou un raccourci.",
  },
  {
    id: "multi",
    title: "Plusieurs appareils",
    body: "Gérez vos téléphones et ordinateurs depuis une seule liste, avec un historique et des appareils de confiance.",
  },
  {
    id: "bidirectional",
    title: "Dans les deux sens",
    body: "Recopiez votre téléphone sur l'ordinateur, ou affichez l'écran de l'ordinateur sur votre téléphone.",
  },
];

export type Support = "planned" | "limited" | "studying" | "impossible";

export const supportLabel: Record<Support, string> = {
  planned: "Prévu",
  limited: "Prévu, avec limites",
  studying: "À l'étude",
  impossible: "Impossible",
};

export const compatColumns = ["Windows", "macOS", "Android", "iOS / iPadOS"] as const;

export const compatRows: { feature: string; cells: { s: Support; note?: string }[] }[] = [
  {
    feature: "Partager l'écran de cet appareil",
    cells: [
      { s: "planned" },
      { s: "planned", note: "Permission « Enregistrement de l'écran » requise." },
      { s: "planned", note: "Android demande votre accord à chaque session." },
      { s: "limited", note: "Lancé par vous depuis le Centre de contrôle (ReplayKit)." },
    ],
  },
  {
    feature: "Afficher l'écran d'un autre appareil",
    cells: [{ s: "planned" }, { s: "planned" }, { s: "planned" }, { s: "planned" }],
  },
  {
    feature: "Être contrôlé à distance",
    cells: [
      { s: "planned" },
      { s: "planned", note: "Permission « Accessibilité » requise." },
      { s: "limited", note: "Via câble USB et débogage ADB." },
      { s: "impossible", note: "iOS n'autorise aucune application à piloter l'appareil." },
    ],
  },
  {
    feature: "Connexion USB",
    cells: [{ s: "planned" }, { s: "planned" }, { s: "planned" }, { s: "studying" }],
  },
  {
    feature: "Enregistrement et captures",
    cells: [{ s: "planned" }, { s: "planned" }, { s: "planned" }, { s: "planned" }],
  },
];

export const steps = [
  {
    title: "Installez MansoMirror",
    body: "Sur l'ordinateur et sur le téléphone. Aucun compte n'est nécessaire pour un usage sur votre réseau local.",
  },
  {
    title: "Connectez vos appareils",
    body: "Scannez le QR code affiché par l'ordinateur, saisissez le code à 6 chiffres, ou branchez le câble USB.",
  },
  {
    title: "Lancez la session",
    body: "Acceptez la demande sur l'appareil partagé. L'écran apparaît, et un seul bouton suffit pour tout couper.",
  },
];

export const faq = [
  {
    q: "Qu'est-ce que MansoMirror ?",
    a: "Un ensemble d'applications pour afficher et contrôler vos appareils les uns depuis les autres : téléphone sur ordinateur, ordinateur sur téléphone, en Wi-Fi ou en USB. Le projet est en cours de développement : l'application pour ordinateurs (Windows, macOS, Linux) est en bêta et permet de partager l'écran d'un ordinateur avec un autre ; l'application mobile est à venir.",
  },
  {
    q: "Comment connecter mon téléphone ?",
    a: "Ouvrez MansoMirror sur les deux appareils, puis scannez le QR code affiché par l'ordinateur ou saisissez son code à 6 chiffres. Le code expire au bout de deux minutes et ne fonctionne qu'une fois.",
  },
  {
    q: "Puis-je utiliser une connexion USB ?",
    a: "Oui pour Android : la connexion USB est prévue dès la première version et permet aussi le contrôle à distance. Pour iPhone et iPad, l'USB est à l'étude ; la connexion se fera en Wi-Fi.",
  },
  {
    q: "Le logiciel fonctionne-t-il sans Internet ?",
    a: "Oui. Sur un même réseau Wi-Fi ou par câble USB, les appareils communiquent directement. Internet n'est utile que pour se connecter à un appareil situé sur un autre réseau.",
  },
  {
    q: "Quels appareils sont compatibles ?",
    a: "Windows 10 (1903) et plus récent, macOS 12.3 et plus récent, Android 10 et plus récent, iOS et iPadOS 15 et plus récent. Ces versions minimales seront confirmées par des tests sur appareils réels avant la publication.",
  },
  {
    q: "Le contrôle à distance est-il disponible ?",
    a: "Il est prévu pour Windows, macOS et Android (via USB). Il ne sera pas possible de contrôler un iPhone ou un iPad : Apple ne permet à aucune application de le faire.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Le flux est chiffré de bout en bout (WebRTC, DTLS-SRTP) et va directement d'un appareil à l'autre. Aucune session ne démarre sans votre accord sur l'appareil partagé, et rien n'est enregistré sans votre demande.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Pendant le développement, posez vos questions et signalez les problèmes sur la page GitHub du projet.",
  },
];
