"use client";

import { useEffect, useState } from "react";

type Mode = "auto" | "light" | "dark";
const KEY = "mm-theme";
const next: Record<Mode, Mode> = { auto: "light", light: "dark", dark: "auto" };
const label: Record<Mode, string> = { auto: "Thème automatique", light: "Thème clair", dark: "Thème sombre" };

/** Inline script run before paint so a forced theme never flashes. */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") setMode(t);
    } catch {}
  }, []);

  function cycle() {
    const m = next[mode];
    setMode(m);
    const root = document.documentElement;
    if (m === "auto") delete root.dataset.theme;
    else root.dataset.theme = m;
    try {
      if (m === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, m);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-bg-subtle hover:text-ink"
      aria-label={`${label[mode]} — changer`}
      title={label[mode]}
      data-testid="theme-toggle"
      data-mode={mode}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {mode === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {mode === "dark" && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
        {mode === "auto" && (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
