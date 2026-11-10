import { useEffect, useRef, useState } from "react";
import type { AndroidDevice, AndroidInput, MansoApi } from "../shared/api.ts";
import { H264CanvasDecoder, type DecoderStats } from "./h264-decoder.ts";
import { Icon, Svg, useElapsed, type Toast } from "./ui.tsx";

const mm = (window as unknown as { mm: MansoApi }).mm;

const Keycodes: Record<string, number> = {
  Backspace: 67,
  Enter: 66,
  Tab: 61,
  Delete: 112,
  ArrowUp: 19,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
};

// ---------------------------------------------------------------------------
// Panel in the Devices view
// ---------------------------------------------------------------------------
export function AndroidPanel({ onOpen }: { onOpen: (d: AndroidDevice) => void }) {
  const [status, setStatus] = useState<{ adb: boolean; server: boolean; available: boolean } | null>(null);
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [wifiOpen, setWifiOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void mm.androidStatus().then((s) => alive && setStatus(s));
    const poll = async () => {
      const list = await mm.androidDevices().catch(() => []);
      if (alive) setDevices(list);
    };
    void poll();
    const t = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!status) return null;
  return (
    <section className="panel" aria-labelledby="android-title" data-testid="android">
      <div className="panel-head">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M10 5h4" />
        </svg>
        <h2 id="android-title">Afficher et contrôler un Android</h2>
        <span className="tag">USB · Wi-Fi</span>
      </div>

      {!status.available ? (
        <p className="muted">
          {!status.adb
            ? "L'outil Android « adb » n'est pas installé sur cet ordinateur. Sous Windows, il est fourni avec MansoMirror ; sous macOS : brew install android-platform-tools ; sous Linux : sudo apt install adb."
            : "Le composant MansoMirror pour Android est absent de cette installation. Réinstallez l'application."}
        </p>
      ) : (
        <>
          {devices.length === 0 ? (
            <div className="muted small">
              <p>Aucun téléphone détecté. Pour en brancher un :</p>
              <ol className="steps">
                <li>Sur le téléphone : Paramètres → À propos → touchez 7 fois « Numéro de build ».</li>
                <li>Paramètres → Options pour les développeurs → activez « Débogage USB ».</li>
                <li>Branchez le câble USB et acceptez la demande sur le téléphone.</li>
              </ol>
            </div>
          ) : (
            <ul className="device-list">
              {devices.map((d) => (
                <li key={d.serial}>
                  <span className={`dot ${d.state === "device" ? "ok" : "off"}`} />
                  <span className="grow">
                    {d.model}
                    <span className="mono muted small"> {d.transport === "usb" ? "USB" : "Wi-Fi"}</span>
                    {d.state === "unauthorized" && <span className="warn small"> · acceptez le débogage sur le téléphone</span>}
                    {d.state === "offline" && <span className="muted small"> · hors ligne</span>}
                  </span>
                  <button className="btn primary sm" disabled={d.state !== "device"} onClick={() => onOpen(d)}>
                    Afficher
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn ghost sm wifi-toggle" onClick={() => setWifiOpen((o) => !o)} aria-expanded={wifiOpen}>
            {wifiOpen ? "Masquer" : "Connecter en Wi-Fi (Android 11+)"}
          </button>
          {wifiOpen && <WifiPairing />}
        </>
      )}
    </section>
  );
}

function WifiPairing() {
  const [pairAddr, setPairAddr] = useState("");
  const [code, setCode] = useState("");
  const [connAddr, setConnAddr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.message ?? "Échec." });
  };
  return (
    <div className="wifi-pair">
      <p className="muted small">
        Sur le téléphone : Options pour les développeurs → <b>Débogage sans fil</b> → « Associer l'appareil avec un code ».
      </p>
      <div className="row">
        <input className="mono grow" aria-label="Adresse d'association" placeholder="192.168.1.42:37155" value={pairAddr} onChange={(e) => setPairAddr(e.target.value.trim())} />
        <input className="mono port" aria-label="Code d'association" placeholder="123456" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <button className="btn ghost sm" disabled={busy || !pairAddr || code.length !== 6} onClick={() => act(() => mm.androidPair(pairAddr, code), "Téléphone associé. Connectez-le ci-dessous.")}>
          Associer
        </button>
      </div>
      <p className="muted small">Puis l'adresse affichée en haut de l'écran « Débogage sans fil » :</p>
      <div className="row">
        <input className="mono grow" aria-label="Adresse de connexion" placeholder="192.168.1.42:41867" value={connAddr} onChange={(e) => setConnAddr(e.target.value.trim())} />
        <button className="btn ghost sm" disabled={busy || !connAddr} onClick={() => act(() => mm.androidConnect(connAddr), "Connecté. Le téléphone apparaît dans la liste.")}>
          Connecter
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? "small" : "error"} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full-window phone view
// ---------------------------------------------------------------------------
export function AndroidScreen({
  device,
  onClose,
  onKill,
  toast,
}: {
  device: AndroidDevice;
  onClose: (reason?: string) => void;
  onKill: () => void;
  toast: (t: string, tone?: Toast["tone"]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const decoder = useRef<H264CanvasDecoder | null>(null);
  const [name, setName] = useState(device.model);
  const [stats, setStats] = useState<DecoderStats | null>(null);
  const [control, setControl] = useState(true);
  const [since] = useState(Date.now());
  const elapsed = useElapsed(since);
  const down = useRef(false);
  const serial = device.serial;

  const send = (i: AndroidInput) => {
    if (control) void mm.androidInput(serial, i);
  };

  useEffect(() => {
    const d = new H264CanvasDecoder(canvas.current!, setStats, () => void mm.androidInput(serial, { kind: "reset-video" }));
    decoder.current = d;
    const offVideo = mm.onAndroidVideo((p) => {
      if (p.serial === serial) d.push(p);
    });
    const offEvent = mm.onAndroidEvent((e) => {
      if (e.serial !== serial) return;
      if (e.type === "meta" && e.meta.deviceName) setName(e.meta.deviceName);
      if (e.type === "ended") onClose(e.reason);
    });
    // If no picture shows up quickly (missed parameters, slow phone), ask the phone
    // to send its parameters and a key frame again, until a frame is decoded.
    let retry: ReturnType<typeof setInterval> | null = null;
    void mm.androidStart(serial, true).then((r) => {
      if (!r.ok) return onClose(r.message);
      retry = setInterval(() => {
        if (d.stats.decoded > 0) {
          if (retry) clearInterval(retry);
          retry = null;
        } else void mm.androidInput(serial, { kind: "reset-video" });
      }, 1500);
    });
    stage.current?.focus();
    return () => {
      if (retry) clearInterval(retry);
      offVideo();
      offEvent();
      d.close();
      void mm.androidStop(serial);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial]);

  const point = (e: { clientX: number; clientY: number }) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * c.width);
    const y = Math.round(((e.clientY - r.top) / r.height) * c.height);
    return { x: Math.max(0, Math.min(c.width - 1, x)), y: Math.max(0, Math.min(c.height - 1, y)), w: c.width, h: c.height };
  };

  async function screenshot() {
    const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, "image/png"));
    if (!blob) return;
    if (await mm.saveFile("png", await blob.arrayBuffer())) toast("Capture enregistrée.", "ok");
  }

  const nav = (button: "back" | "home" | "recents" | "power" | "volume-up" | "volume-down") => send({ kind: "nav", button });

  return (
    <div className="viewer android" data-testid="android-screen">
      <header className="viewer-bar">
        <span className="live">
          <span className="dot live-dot" />
        </span>
        <b>{name}</b>
        <span className="mono muted small">{elapsed}</span>
        <span className="mono muted small stats" data-testid="android-stats">
          {stats && stats.width ? `${stats.width}×${stats.height} · ${stats.fps} i/s · ${device.transport === "usb" ? "USB" : "Wi-Fi"}` : "Connexion au téléphone…"}
        </span>
        <span className="grow" />
        <button className="icon-btn" onClick={() => nav("volume-down")} title="Volume −" aria-label="Volume moins">
          <Svg d="M4 9h4l5-4v14l-5-4H4zM16 12h5" />
        </button>
        <button className="icon-btn" onClick={() => nav("volume-up")} title="Volume +" aria-label="Volume plus">
          <Svg d="M4 9h4l5-4v14l-5-4H4zM16 12h5M18.5 9.5v5" />
        </button>
        <button className="icon-btn" onClick={() => nav("power")} title="Verrouiller / allumer" aria-label="Bouton marche">
          <Svg d="M12 3v8M7 6.5a7 7 0 1 0 10 0" />
        </button>
        <button className="icon-btn" onClick={() => void screenshot()} title="Capture d'écran" aria-label="Capture d'écran">
          <Svg d={Icon.camera} />
        </button>
        <button className={`btn ghost sm ${control ? "" : "off"}`} onClick={() => setControl((c) => !c)} aria-pressed={control} title="Contrôler le téléphone à la souris et au clavier">
          {control ? "Contrôle activé" : "Lecture seule"}
        </button>
        <button className="icon-btn" onClick={() => void stage.current?.requestFullscreen()} title="Plein écran" aria-label="Plein écran">
          <Svg d={Icon.full} />
        </button>
        <button className="btn ghost sm" onClick={() => onClose()}>
          Déconnecter
        </button>
        <button className="btn danger sm" onClick={onKill} title="Ctrl+Alt+K">
          Tout couper
        </button>
      </header>
      <div
        className="stage phone-stage"
        ref={stage}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === "Escape") {
            nav("back");
          } else if (Keycodes[e.key]) {
            send({ kind: "key", action: "down", keycode: Keycodes[e.key] });
            send({ kind: "key", action: "up", keycode: Keycodes[e.key] });
          } else if (e.key.length === 1) {
            send({ kind: "text", text: e.key });
          } else return;
          e.preventDefault();
        }}
      >
        <canvas
          ref={canvas}
          width={1}
          height={1}
          className="phone-canvas"
          data-testid="android-canvas"
          onContextMenu={(e) => {
            e.preventDefault();
            nav("back");
          }}
          onPointerDown={(e) => {
            if (e.button === 1) return nav("home");
            if (e.button !== 0) return;
            down.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            send({ kind: "touch", action: "down", ...point(e) });
          }}
          onPointerMove={(e) => {
            if (down.current) send({ kind: "touch", action: "move", ...point(e) });
          }}
          onPointerUp={(e) => {
            if (!down.current) return;
            down.current = false;
            send({ kind: "touch", action: "up", ...point(e) });
          }}
          onWheel={(e) => {
            const p = point(e);
            send({ kind: "scroll", ...p, dx: Math.max(-16, Math.min(16, -e.deltaX / 50)), dy: Math.max(-16, Math.min(16, -e.deltaY / 50)) });
          }}
        />
        <nav className="android-nav" aria-label="Boutons Android">
          <button onClick={() => nav("back")} aria-label="Retour" title="Retour (clic droit, Échap)">
            <Svg d="M15 6l-6 6 6 6" />
          </button>
          <button onClick={() => nav("home")} aria-label="Accueil" title="Accueil (clic molette)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="6" />
            </svg>
          </button>
          <button onClick={() => nav("recents")} aria-label="Applications récentes" title="Applications récentes">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
}
