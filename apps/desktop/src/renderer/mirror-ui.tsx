import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { MansoApi } from "../shared/api.ts";
import { Icon, Svg, type Toast } from "./ui.tsx";

const mm = (window as unknown as { mm: MansoApi }).mm;

/** Space around the phone, used both by the CSS and to size the compact window. */
const PAD = 16;
const BEZEL = 12;
const CAPTION = 30;
const TOOLBAR = 60;
const GAP = 14;

export const MirrorIcon = {
  record: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  stop: "M7 7h10v10H7z",
  pin: "M9 4h6l-1 6 3 3H7l3-3-1-6ZM12 13v7",
  compact: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM11 18h2",
  power: "M12 3v8M7 6.5a7 7 0 1 0 10 0",
  volDown: "M4 9h4l5-4v14l-5-4H4zM16 12h5",
  volUp: "M4 9h4l5-4v14l-5-4H4zM16 12h5M18.5 9.5v5",
  back: "M15 6l-6 6 6 6",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 5 15.5L4 12.5a1.5 1.5 0 0 1 2.6-1.4L8 13",
  eject: "M5 19h14M12 5l6 8H6z",
};

export function ToolButton({ icon, label, onClick, active, danger, children }: { icon?: string; label: string; onClick: () => void; active?: boolean; danger?: boolean; children?: ReactNode }) {
  return (
    <button
      className={`tool${active ? " on" : ""}${danger ? " danger" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
    >
      {children ?? <Svg d={icon!} size={20} />}
    </button>
  );
}

/** Screenshot, video recording, always-on-top and compact window for a mirrored phone. */
export function useMirrorTools(
  canvas: RefObject<HTMLCanvasElement | null>,
  frame: RefObject<HTMLElement | null>,
  toast: (t: string, tone?: Toast["tone"]) => void,
  floating = false,
  videoSize?: { width: number; height: number } | null,
) {
  const [recording, setRecording] = useState(false);
  const [onTop, setOnTop] = useState(floating);
  const [compact, setCompact] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);

  // Leave the window as it was when the phone screen closes.
  useEffect(
    () => () => {
      if (rec.current?.state === "recording") rec.current.stop();
      if (!floating) void mm.windowLayout({ compact: false, onTop: false });
    },
    [floating],
  );
  // Floating window: always exactly the size of the phone (follows rotation).
  const vw = videoSize?.width ?? 0;
  const vh = videoSize?.height ?? 0;
  useEffect(() => {
    if (floating && vw > 1 && vh > 1) void mm.windowLayout({ compact: true, onTop, ...size() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floating, vw, vh]);

  async function screenshot() {
    const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, "image/png"));
    if (!blob) return;
    if (await mm.saveFile("png", await blob.arrayBuffer())) toast("Capture enregistrée.", "ok");
  }

  function toggleRecording() {
    if (rec.current?.state === "recording") {
      rec.current.stop();
      return;
    }
    const stream = canvas.current!.captureStream(60);
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12_000_000 });
    const parts: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    r.onstop = async () => {
      setRecording(false);
      rec.current = null;
      const blob = new Blob(parts, { type: "video/webm" });
      if (blob.size && (await mm.saveFile("webm", await blob.arrayBuffer()))) toast("Vidéo enregistrée.", "ok");
    };
    r.start(1000);
    rec.current = r;
    setRecording(true);
    toast("Enregistrement de l'image lancé (sans le son).");
  }

  async function toggleOnTop() {
    const next = !onTop;
    setOnTop(next);
    await mm.windowLayout({ compact, onTop: next, ...size() });
  }

  /** Window size that fits the phone at ~85 % of the screen height. */
  function size() {
    const c = canvas.current!;
    const aspect = c.width > 1 && c.height > 1 ? c.width / c.height : 9 / 19.5;
    const c2 = canvas.current!;
    const landscape = c2.width > c2.height;
    const screenH = Math.round(Math.min(window.screen.availHeight * (landscape ? 0.6 : 0.88), 1040) - 2 * PAD - CAPTION - 2 * BEZEL);
    const width = Math.round(2 * PAD + screenH * aspect + 2 * BEZEL + GAP + TOOLBAR);
    const height = Math.round(2 * PAD + CAPTION + screenH + 2 * BEZEL);
    return { width, height };
  }

  async function toggleCompact() {
    const next = !compact;
    setCompact(next);
    await mm.windowLayout({ compact: next, onTop, ...size() });
  }

  return {
    recording,
    onTop,
    compact,
    screenshot,
    toggleRecording,
    toggleOnTop,
    toggleCompact,
    fullscreen: () => void frame.current?.requestFullscreen(),
    minimize: () => void mm.windowAction("minimize"),
  };
}

/** The phone, drawn in a device frame, with the vertical toolbar beside it. */
export function MirrorLayout({
  testId,
  caption,
  phone,
  tools,
  stageRef,
  stageProps,
  live,
  floating,
  onClose,
}: {
  testId: string;
  caption: ReactNode;
  phone: ReactNode;
  tools: ReactNode;
  stageRef: RefObject<HTMLDivElement | null>;
  stageProps?: React.HTMLAttributes<HTMLDivElement> & { tabIndex?: number };
  live: boolean;
  floating?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className={`mirror${floating ? " floating" : ""}`} data-testid={testId} ref={stageRef} {...stageProps}>
      <div className="mirror-main">
        <div className="mirror-caption">
          <span className={`dot ${live ? "live-dot" : ""}`} />
          {caption}
          {floating && (
            <span className="win-btns">
              <button className="win-btn" onClick={() => void mm.windowAction("minimize")} title="Réduire" aria-label="Réduire">
                <Svg d="M6 12h12" size={16} />
              </button>
              <button className="win-btn" onClick={onClose} title="Fermer" aria-label="Fermer">
                <Svg d={Icon.close} size={16} />
              </button>
            </span>
          )}
        </div>
        <div className="phone-frame">
          <span className="phone-key left" />
          <span className="phone-key left second" />
          <span className="phone-key right" />
          <div className="phone-screen">{phone}</div>
        </div>
      </div>
      <aside className="mirror-tools" aria-label="Outils">
        {tools}
      </aside>
    </div>
  );
}

/** Record button glyph: a red dot, a red square while recording. */
export function RecordGlyph({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {on ? <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="#e5484d" /> : <circle cx="12" cy="12" r="5" fill="#e5484d" />}
    </svg>
  );
}

export function ToolSeparator() {
  return <span className="tool-sep" aria-hidden="true" />;
}

export { Icon };
