import { useEffect, useRef, useState } from "react";
import type { MansoApi } from "../shared/api.ts";
import { H264CanvasDecoder, type DecoderStats } from "./h264-decoder.ts";
import { Icon, useElapsed, type Toast } from "./ui.tsx";
import { MirrorIcon, MirrorLayout, RecordGlyph, ToolButton, ToolSeparator, useMirrorTools } from "./mirror-ui.tsx";

const mm = (window as unknown as { mm: MansoApi }).mm;

/**
 * iPhone / iPad mirrored by AirPlay, shown large inside the MansoMirror window.
 * Sound is played by the computer. iOS does not allow remote control, so the
 * picture is view-only.
 */
export function IPhoneScreen({ name, onStop, onKill, toast, floating = false }: { name: string; onStop: () => void; onKill: () => void; toast: (t: string, tone?: Toast["tone"]) => void; floating?: boolean }) {
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

  const t = useMirrorTools(canvas, stage, toast, floating, stats);

  return (
    <MirrorLayout
      testId="iphone-screen"
      stageRef={stage}
      live
      floating={floating}
      onClose={onStop}
      caption={
        <>
          <b>iPhone / iPad</b>
          <span className="mono muted small">{elapsed}</span>
          <span className="mono muted small stats" data-testid="iphone-stats">
            {stats && stats.width ? `${stats.width}×${stats.height} · ${stats.fps} i/s · AirPlay · son sur l'ordinateur` : "Réception de l'image…"}
          </span>
        </>
      }
      phone={<canvas ref={canvas} width={1} height={1} className="phone-canvas" data-testid="iphone-canvas" title={`Recopié sur ${name}`} />}
      tools={
        <>
          <ToolButton icon={Icon.full} label="Plein écran" onClick={t.fullscreen} />
          <ToolButton icon={Icon.camera} label="Capture d'écran" onClick={() => void t.screenshot()} />
          <ToolButton label={t.recording ? "Arrêter l'enregistrement" : "Enregistrer la vidéo"} onClick={t.toggleRecording} active={t.recording}>
            <RecordGlyph on={t.recording} />
          </ToolButton>
          <ToolButton icon={MirrorIcon.pin} label="Toujours au premier plan" onClick={() => void t.toggleOnTop()} active={t.onTop} />
          {!floating && <ToolButton icon={MirrorIcon.compact} label="Fenêtre à la taille du téléphone" onClick={() => void t.toggleCompact()} active={t.compact} />}
          <ToolSeparator />
          <ToolButton icon={MirrorIcon.eject} label="Arrêter la réception" onClick={onStop} />
          <ToolButton icon={Icon.close} label="Tout couper" onClick={onKill} danger />
        </>
      }
    />
  );
}
