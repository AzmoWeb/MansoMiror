/**
 * MansoMirror design tokens — single source of truth for colour, type,
 * spacing, radius, elevation and motion across Web, Desktop, Mobile and Admin.
 *
 * Every app consumes these values (CSS variables for web/desktop,
 * a JS object for React Native). Never hard-code a colour in an app.
 */

/** Raw palette. Apps should prefer the semantic `themes` below. */
export const palette = {
  /** "Cobalt" — the MansoMirror brand colour. A deep, saturated blue: crisp on white and on near-black. */
  cobalt: {
    50: "#EEF2FF",
    100: "#DDE5FF",
    200: "#C0CEFF",
    300: "#9CB1FF",
    400: "#7B98FF",
    500: "#5577F5",
    600: "#3A5BE8",
    700: "#2448D8",
    800: "#1E3BB2",
    900: "#1C338C",
    950: "#0E1A4D",
  },

  /** Warm graphite neutrals — slightly warm so white UIs do not feel clinical. */
  graphite: {
    0: "#FFFFFF",
    25: "#FBFBFA",
    50: "#F5F5F3",
    100: "#EBEBE8",
    200: "#D9D9D5",
    300: "#BDBDB8",
    400: "#93938D",
    500: "#6E6E68",
    600: "#55554F",
    700: "#3F3F3B",
    800: "#2A2A27",
    900: "#1B1B19",
    950: "#111110",
  },
  /** "Signal" — reserved for live/recording state and destructive actions. */
  signal: {
    300: "#FF9B85",
    400: "#FF7A5C",
    500: "#F2552F",
    600: "#C93D1C",
    700: "#A13017",
  },
  amber: { 300: "#FCD34D", 400: "#F5B92E", 600: "#B07A06", 700: "#8A5E05" },
  green: { 300: "#7EE0A3", 400: "#4CCB7E", 600: "#1F8A4C", 700: "#17703D" },
} as const;

export type ThemeName = "light" | "dark";

export interface SemanticColors {
  bg: string;
  bgSubtle: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentHover: string;
  accentText: string;
  /** Text colour placed ON an accent-filled surface (buttons). */
  onAccent: string;
  accentSoft: string;
  live: string;
  liveText: string;
  danger: string;
  dangerText: string;
  warningText: string;
  successText: string;
  focusRing: string;
}

export const themes: Record<ThemeName, SemanticColors> = {
  light: {
    bg: palette.graphite[0],
    bgSubtle: palette.graphite[50],
    surface: palette.graphite[0],
    surfaceRaised: palette.graphite[25],
    border: palette.graphite[200],
    borderStrong: palette.graphite[300],
    text: palette.graphite[900],
    textMuted: palette.graphite[600],
    textSubtle: palette.graphite[500],
    accent: palette.cobalt[700],
    accentHover: palette.cobalt[800],
    accentText: palette.cobalt[700],
    onAccent: palette.graphite[0],
    accentSoft: palette.cobalt[50],
    live: palette.signal[500],
    liveText: palette.signal[700],
    danger: palette.signal[600],
    dangerText: palette.signal[700],
    warningText: palette.amber[700],
    successText: palette.green[700],
    focusRing: palette.cobalt[500],
  },
  dark: {
    bg: palette.graphite[950],
    bgSubtle: palette.graphite[900],
    surface: palette.graphite[900],
    surfaceRaised: palette.graphite[800],
    border: palette.graphite[800],
    borderStrong: palette.graphite[700],
    text: palette.graphite[50],
    textMuted: palette.graphite[300],
    textSubtle: palette.graphite[400],
    accent: palette.cobalt[400],
    accentHover: palette.cobalt[300],
    accentText: palette.cobalt[300],
    onAccent: palette.cobalt[950],
    accentSoft: palette.cobalt[950],
    live: palette.signal[400],
    liveText: palette.signal[300],
    danger: palette.signal[400],
    dangerText: palette.signal[300],
    warningText: palette.amber[300],
    successText: palette.green[300],
    focusRing: palette.cobalt[300],
  },
};

export const typography = {
  family: {
    /** Display & headings — geometric, slightly technical. */
    display: '"Manrope", "Inter", system-ui, sans-serif',
    /** UI & body text. */
    sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    /** PIN codes, IPs, latency/bitrate figures. */
    mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
  /** Type scale in rem (base 16px), ratio ~1.2 for UI, larger steps for display. */
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.375rem",
    "2xl": "1.75rem",
    "3xl": "2.25rem",
    "4xl": "3rem",
    "5xl": "4rem",
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  leading: { tight: 1.1, snug: 1.3, normal: 1.5, relaxed: 1.65 },
  tracking: { tight: "-0.02em", normal: "0", wide: "0.04em" },
} as const;

/** 4px base grid. */
export const space = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

/** Slightly rounded — never pill-shaped except for status chips. */
export const radius = {
  xs: "4px",
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  full: "9999px",
} as const;

export const shadow = {
  light: {
    sm: "0 1px 2px rgba(17,17,16,0.06)",
    md: "0 2px 8px rgba(17,17,16,0.06), 0 1px 2px rgba(17,17,16,0.04)",
    lg: "0 12px 32px rgba(17,17,16,0.08), 0 2px 6px rgba(17,17,16,0.04)",
  },
  dark: {
    sm: "0 1px 2px rgba(0,0,0,0.4)",
    md: "0 2px 8px rgba(0,0,0,0.45)",
    lg: "0 12px 32px rgba(0,0,0,0.55)",
  },
} as const;

/**
 * Motion. Durations in ms so they work for CSS, Framer Motion and Reanimated.
 * All motion must collapse to `instant` when the OS asks for reduced motion.
 */
export const motion = {
  duration: { instant: 0, fast: 120, base: 200, slow: 320, deliberate: 480 },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    enter: [0, 0, 0, 1] as const,
    exit: [0.3, 0, 1, 1] as const,
  },
  /** Spring for Framer Motion / Reanimated micro-interactions. */
  spring: { stiffness: 420, damping: 34, mass: 1 },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
