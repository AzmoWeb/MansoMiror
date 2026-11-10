import { useEffect, useRef, useState } from "react";
import type { MansoApi } from "../shared/api.ts";
import { H264CanvasDecoder, type DecoderStats } from "./h264-decoder.ts";
import { Icon, Svg, useElapsed, type Toast } from "./ui.tsx";

const mm = (window as unknown as { mm: MansoApi }).mm;

/**
 * iPhone / iPad mirrored by AirPlay, shown large inside the MansoMirror window.
 * Sound is played by the computer. iOS does not allow remote control, so the
 * picture is view-only.
 */
export function IPhoneScreen({ name, onStop, onKill, toast }: { name: string; onStop: () => void; onKill: () => void; toast: (t: string, tone?: Toast["tone"]) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DecoderStats | null>(null);
  const [since] = useState(Date.now());
  const elapsed = useElapsed(since);

  useEffect(() => {
    // The iPhone sent its only key frame when mirroring started, before this
    // screen existed: ask for it (and the frames since) again, then go live.
    const d = new H264CanvasDecoder(canvas.current!, setStats, () => void mm.airplayVideoReplay(), (m) => void mm.diag(`iphone video: ${m}`));
    const off = mm.onAirPlayVideo((p) => d.push(p));
    void mm.airplayVideoReplay();
    return () => {
      off();
      d.close();
    };
  }, []);

  async function screenshot() {
    const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, "image/png"));
    if (!blob) return;
    if (await mm.saveFile("png", await blob.arrayBuffer())) toast("Capture enregistrée.", "ok");
  }

  return (
    <div className="viewer android" data-testid="iphone-screen">
      <header className="viewer-bar">
        <span className="live">
          <span className="dot live-dot" />
        </span>
        <b>iPhone / iPad</b>
        <span className="muted small">sur {name}</span>
        <span className="mono muted small">{elapsed}</span>
        <span className="mono muted small stats" data-testid="iphone-stats">
          {stats && stats.width ? `${stats.width}×${stats.height} · ${stats.fps} i/s · AirPlay · son sur l'ordinateur` : "Réception de l'image…"}
        </span>
        <span className="grow" />
        <button className="icon-btn" onClick={() => void screenshot()} title="Capture d'écran" aria-label="Capture d'écran">
          <Svg d={Icon.camera} />
        </button>
        <button className="icon-btn" onClick={() => void stage.current?.requestFullscreen()} title="Plein écran" aria-label="Plein écran">
          <Svg d={Icon.full} />
        </button>
        <button className="btn ghost sm" onClick={onStop}>
          Arrêter la réception
        </button>
        <button className="btn danger sm" onClick={onKill} title="Ctrl+Alt+K">
          Tout couper
        </button>
      </header>
      <div className="stage phone-stage iphone-stage" ref={stage}>
        <canvas ref={canvas} width={1} height={1} className="phone-canvas iphone-canvas" data-testid="iphone-canvas" />
      </div>
    </div>
  );
}
