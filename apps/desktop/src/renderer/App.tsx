import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateState, AirPlayState, AppInfo, CaptureSource, DiscoveredDevice, HistoryEntry, HostEvent, MansoApi, Settings } from "../shared/api.ts";
import { errorText, type ErrorCode } from "../shared/protocol.ts";
import { bitrateFor, captureScreen, createHost, createViewer, watchStats, type LiveStats } from "./webrtc.ts";
import { Icon, LogoMark, Modal, Svg, Toasts, useCountdown, useElapsed, type Toast } from "./ui.tsx";
import { AndroidPanel, AndroidScreen } from "./android-ui.tsx";
import { IPhoneScreen } from "./iphone-ui.tsx";
import type { AndroidDevice } from "../shared/api.ts";

declare global {
  interface Window {
    mm: MansoApi;
  }
}
const mm = window.mm;

type View = "devices" | "history" | "settings";

type HostState =
  | { s: "idle" }
  | { s: "picking"; sources: CaptureSource[] | null }
  | { s: "waiting"; pin: string; expiresAt: number; port: number; addresses: string[]; pinState?: "locked" | "expired" }
  | { s: "sharing"; peer: string; since: number };

type ViewerState =
  | { s: "idle" }
  | { s: "pin"; target: { name: string; host: string; port: number }; error?: string; busy?: boolean }
  | { s: "watching"; hostName: string; stream: MediaStream; since: number };

const connectError = (code: string, remaining?: number) => {
  if (code === "unreachable") return "Ordinateur injoignable. Vérifiez l'adresse et que MansoMirror y partage son écran.";
  if (code === "mitm") return "L'ordinateur distant n'a pas prouvé qu'il connaît le code. Connexion bloquée par sécurité.";
  const base = errorText[code as ErrorCode] ?? "Connexion impossible.";
  return code === "bad-pin" && remaining !== undefined ? `${base} Encore ${remaining} essai${remaining > 1 ? "s" : ""}.` : base;
};

export function App() {
  const [view, setView] = useState<View>("devices");
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [host, setHost] = useState<HostState>({ s: "idle" });
  const [viewer, setViewer] = useState<ViewerState>({ s: "idle" });
  const [request, setRequest] = useState<Extract<HostEvent, { type: "request" }> | null>(null);
  const [peerRecording, setPeerRecording] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const hostPc = useRef<RTCPeerConnection | null>(null);
  const viewerPc = useRef<RTCPeerConnection | null>(null);

  const toast = useCallback((text: string, tone?: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    void mm.info().then(setInfo);
    void mm.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    if (settings.theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings?.theme]);

  // ----- host side -----------------------------------------------------------
  const stopHostMedia = useCallback(() => {
    hostPc.current?.close();
    hostPc.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopSharing = useCallback(async () => {
    await mm.hostStop();
    stopHostMedia();
    setRequest(null);
    setPeerRecording(false);
    setHost({ s: "idle" });
  }, [stopHostMedia]);

  useEffect(
    () =>
      mm.onHostEvent((e) => {
        switch (e.type) {
          case "request":
            setRequest(e);
            break;
          case "connected":
            setHost({ s: "sharing", peer: e.name, since: Date.now() });
            toast(`${e.name} voit maintenant votre écran.`, "ok");
            break;
          case "ended":
            toast("Le partage est terminé.");
            void stopSharing();
            break;
          case "recording":
            setPeerRecording(e.on);
            toast(e.on ? "L'autre ordinateur enregistre votre écran." : "L'enregistrement est arrêté.");
            break;
          case "pin":
            if (e.state !== "used") setHost((h) => (h.s === "waiting" ? { ...h, pinState: e.state as "locked" | "expired" } : h));
            break;
          case "attempt":
            if (!e.ok) toast(`Code incorrect saisi depuis ${e.address.replace("::ffff:", "")}.`, "error");
            break;
        }
      }),
    [toast, stopSharing],
  );

  async function startShare() {
    setHost({ s: "picking", sources: null });
    try {
      setHost({ s: "picking", sources: await mm.listSources() });
    } catch {
      toast("Impossible de lister les écrans. Vérifiez l'autorisation d'enregistrement de l'écran.", "error");
      setHost({ s: "idle" });
    }
  }

  async function pickSource(src: CaptureSource) {
    if (!settings) return;
    try {
      await mm.selectSource(src.id);
      const stream = await captureScreen(settings.maxHeight, settings.fps);
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => void stopSharing());
      const h = await mm.hostStart();
      setHost({ s: "waiting", ...h });
    } catch (err) {
      console.error("share failed", err);
      stopHostMedia();
      await mm.hostStop();
      const msg = String(err).includes("EADDRINUSE")
        ? `Le port ${settings.port} est déjà utilisé. Changez-le dans les paramètres.`
        : "Impossible de démarrer le partage de cet écran.";
      toast(msg, "error");
      setHost({ s: "idle" });
    }
  }

  async function newPin() {
    const p = await mm.hostNewPin();
    setHost((h) => (h.s === "waiting" ? { ...h, ...p, pinState: undefined } : h));
  }

  async function answerRequest(accept: boolean) {
    const r = request;
    setRequest(null);
    if (!r) return;
    if (!accept || !streamRef.current || !settings) {
      await mm.hostRefuse(r.requestId);
      await newPin();
      return;
    }
    try {
      const { pc, answerSdp } = await createHost(streamRef.current, r.offerSdp, bitrateFor(settings.maxHeight, settings.fps));
      hostPc.current = pc;
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed") {
          toast("Connexion perdue avec l'autre ordinateur.", "error");
          void stopSharing();
        }
      });
      await mm.hostAccept(r.requestId, answerSdp);
    } catch {
      await mm.hostRefuse(r.requestId);
      toast("Échec de l'établissement de la connexion.", "error");
    }
  }

  // ----- viewer side -----------------------------------------------------------
  const stopViewing = useCallback(async (silent = false) => {
    viewerPc.current?.close();
    viewerPc.current = null;
    await mm.viewerDisconnect();
    setViewer({ s: "idle" });
    if (!silent) toast("Vous êtes déconnecté.");
  }, [toast]);

  useEffect(
    () =>
      mm.onViewerEvent((e) => {
        if (e.type === "ended") {
          viewerPc.current?.close();
          viewerPc.current = null;
          setViewer({ s: "idle" });
          if (e.reason !== "local") toast("L'autre ordinateur a mis fin au partage.");
        }
      }),
    [toast],
  );

  useEffect(
    () =>
      mm.onKilled(() => {
        viewerPc.current?.close();
        viewerPc.current = null;
        stopHostMedia();
        setRequest(null);
        setPeerRecording(false);
        setHost({ s: "idle" });
        setViewer({ s: "idle" });
        setAndroidDevice(null);
        toast("Toutes les connexions ont été coupées.", "ok");
      }),
    [toast, stopHostMedia],
  );

  async function connect(pin: string) {
    if (viewer.s !== "pin") return;
    const target = viewer.target;
    setViewer({ ...viewer, busy: true, error: undefined });
    const { pc, offerSdp, stream } = await createViewer();
    const res = await mm.viewerConnect({ host: target.host, port: target.port, pin, offerSdp });
    if (!res.ok) {
      pc.close();
      setViewer({ s: "pin", target, error: connectError(res.code, res.remaining) });
      return;
    }
    viewerPc.current = pc;
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed") {
        toast("Connexion perdue.", "error");
        void stopViewing(true);
      }
    });
    await pc.setRemoteDescription({ type: "answer", sdp: res.answerSdp });
    setViewer({ s: "watching", hostName: res.hostName, stream: await stream, since: Date.now() });
  }

  const [androidDevice, setAndroidDevice] = useState<AndroidDevice | null>(null);
  const [airplay, setAirplay] = useState<AirPlayState | null>(null);
  useEffect(() => {
    void mm.airplayState().then(setAirplay);
    return mm.onAirPlay(setAirplay);
  }, []);
  const airplayOn = airplay?.status === "running";

  const active = host.s === "waiting" || host.s === "sharing" || viewer.s === "watching" || airplayOn;

  if (airplay?.status === "running" && airplay.inApp && airplay.streaming) {
    return (
      <>
        <IPhoneScreen name={airplay.name} toast={toast} onKill={() => void mm.killAll()} onStop={() => void mm.airplayStop()} />
        <Toasts items={toasts} />
      </>
    );
  }

  if (androidDevice) {
    return (
      <>
        <AndroidScreen
          device={androidDevice}
          toast={toast}
          onKill={() => void mm.killAll()}
          onClose={(reason) => {
            setAndroidDevice(null);
            if (reason) toast(reason);
          }}
        />
        <Toasts items={toasts} />
      </>
    );
  }

  if (viewer.s === "watching") {
    return (
      <>
        <ViewerScreen state={viewer} pc={viewerPc.current} onLeave={() => void stopViewing()} onKill={() => void mm.killAll()} toast={toast} />
        <Toasts items={toasts} />
      </>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <LogoMark />
          <span>
            Manso<b>Mirror</b>
          </span>
        </div>
        <nav aria-label="Navigation">
          {(
            [
              ["devices", "Appareils", Icon.devices],
              ["history", "Historique", Icon.history],
              ["settings", "Paramètres", Icon.settings],
            ] as const
          ).map(([id, label, icon]) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}>
              <Svg d={icon} />
              {label}
            </button>
          ))}
        </nav>
        <UpdateBox />
        <div className="net">
          <p className="label">Réseau local</p>
          {info?.addresses.length ? (
            info.addresses.map((a) => (
              <p key={a} className="mono">
                <span className="dot ok" /> {a}
              </p>
            ))
          ) : (
            <p className="muted">
              <span className="dot off" /> Aucune connexion réseau
            </p>
          )}
          <p className="muted small">Version {info?.version}</p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <h1>{view === "devices" ? "Appareils" : view === "history" ? "Historique" : "Paramètres"}</h1>
          {active && (
            <button className="btn danger" onClick={() => void mm.killAll()} title="Ctrl+Alt+K">
              Tout couper
            </button>
          )}
        </header>

        {view === "devices" && settings && (
          <DevicesView
            host={host}
            peerRecording={peerRecording}
            onShare={() => void startShare()}
            onPick={(s) => void pickSource(s)}
            onRefresh={() => void startShare()}
            onCancelPick={() => setHost({ s: "idle" })}
            onNewPin={() => void newPin()}
            onStopShare={() => void stopSharing()}
            onConnectTo={(target) => setViewer({ s: "pin", target })}
            onOpenAndroid={setAndroidDevice}
            settings={settings}
          />
        )}
        {view === "history" && <HistoryView />}
        {view === "settings" && settings && <SettingsView settings={settings} onChange={setSettings} hostActive={host.s !== "idle"} />}
      </main>

      {viewer.s === "pin" && (
        <PinDialog target={viewer.target} error={viewer.error} busy={!!viewer.busy} onSubmit={(p) => void connect(p)} onCancel={() => setViewer({ s: "idle" })} />
      )}
      {request && <ConsentDialog request={request} onAnswer={(a) => void answerRequest(a)} />}
      <Toasts items={toasts} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function DevicesView(props: {
  host: HostState;
  peerRecording: boolean;
  settings: Settings;
  onShare: () => void;
  onPick: (s: CaptureSource) => void;
  onRefresh: () => void;
  onCancelPick: () => void;
  onNewPin: () => void;
  onStopShare: () => void;
  onConnectTo: (t: { name: string; host: string; port: number }) => void;
  onOpenAndroid: (d: AndroidDevice) => void;
}) {
  const { host } = props;
  return (
    <div className="devices">
      <section className="panel" aria-labelledby="share-title">
        <div className="panel-head">
          <Svg d={Icon.share} size={20} />
          <h2 id="share-title">Partager cet écran</h2>
        </div>
        {host.s === "idle" && (
          <>
            <p className="muted">Un autre ordinateur pourra voir votre écran après avoir saisi le code affiché ici, et uniquement si vous l'acceptez.</p>
            <button className="btn primary" onClick={props.onShare}>
              Choisir l'écran à partager
            </button>
          </>
        )}
        {host.s === "picking" && <SourcePicker sources={host.sources} onPick={props.onPick} onRefresh={props.onRefresh} onCancel={props.onCancelPick} />}
        {host.s === "waiting" && <WaitingCard state={host} onNewPin={props.onNewPin} onStop={props.onStopShare} />}
        {host.s === "sharing" && <SharingCard state={host} recording={props.peerRecording} onStop={props.onStopShare} />}
      </section>

      <section className="panel" aria-labelledby="view-title">
        <div className="panel-head">
          <Svg d={Icon.view} size={20} />
          <h2 id="view-title">Voir un autre écran</h2>
        </div>
        <Discovered onPick={props.onConnectTo} />
        <ManualConnect defaultPort={props.settings.port} onConnect={props.onConnectTo} />
      </section>

      <AndroidPanel onOpen={props.onOpenAndroid} />
      <AirPlayPanel />
    </div>
  );
}

const installHelp: Record<string, string> = {
  linux: "sudo apt install uxplay gstreamer1.0-plugins-bad gstreamer1.0-libav",
  darwin: "brew install uxplay",
};

/** iPhone / iPad → this computer, via the system "Recopie de l'écran" (AirPlay). */
function AirPlayPanel() {
  const [st, setSt] = useState<AirPlayState | null>(null);
  const [starting, setStarting] = useState(false);
  const [platform, setPlatform] = useState("");
  useEffect(() => {
    void mm.airplayState().then(setSt);
    void mm.info().then((i) => setPlatform(i.platform));
    return mm.onAirPlay(setSt);
  }, []);
  if (!st) return null;

  return (
    <section className="panel" aria-labelledby="airplay-title" data-testid="airplay">
      <div className="panel-head">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
        <h2 id="airplay-title">Recevoir un iPhone ou un iPad</h2>
        <span className="tag">AirPlay</span>
      </div>

      {st.status === "unavailable" && (
        <>
          <p className="muted">
            Pour afficher l'écran d'un iPhone ici, MansoMirror utilise le récepteur AirPlay open source UxPlay, qui n'est pas encore installé
            sur cet ordinateur.
          </p>
          {installHelp[platform] ? (
            <p>
              Installez-le avec : <code className="mono">{installHelp[platform]}</code>
            </p>
          ) : (
            <p className="muted">
              Sous Windows, il sera intégré à l'installeur dans une prochaine version. Il nécessite aussi le service Bonjour d'Apple.
            </p>
          )}
          <button className="btn ghost" onClick={async () => setSt(await mm.airplayState(true))}>
            <Svg d={Icon.refresh} size={16} /> Vérifier à nouveau
          </button>
        </>
      )}

      {(st.status === "stopped" || st.status === "error") && (
        <>
          <p className="muted">
            Activez la réception, puis sur l'iPhone ouvrez le Centre de contrôle et touchez « Recopie de l'écran » : cet ordinateur apparaîtra
            dans la liste. Un code affiché ici sera demandé.
          </p>
          {st.status === "error" && (
            <p className="error" role="alert">
              {st.message}
            </p>
          )}
          <div className="row">
            <button
              className="btn primary"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  setSt(await mm.airplayStart());
                } catch (e) {
                  setSt({ status: "error", message: `Démarrage impossible : ${(e as Error).message}` });
                } finally {
                  setStarting(false);
                }
              }}
            >
              {starting ? "Démarrage…" : "Activer la réception AirPlay"}
            </button>
            {st.status === "error" && (
              <button className="btn ghost" onClick={() => void mm.openLogs()}>
                Ouvrir les journaux
              </button>
            )}
          </div>
        </>
      )}

      {st.status === "running" && (
        <div className="airplay-on">
          <div>
            <p className="live">
              <span className="dot live-dot" /> Visible par les iPhone et iPad du réseau
            </p>
            {st.announced === null && (
              <p className="error" role="alert">
                Ce PC ne s'annonce pas sur le réseau : l'iPhone ne peut pas le voir. Ouvrez les journaux et envoyez-les au support.
              </p>
            )}
            {st.announced && (
              <p className="muted" data-testid="airplay-announced">
                Annoncé sur le réseau à l'adresse {st.announced.join(", ") || "inconnue"}. L'iPhone doit être sur le même réseau (même box).
              </p>
            )}
            {st.notice && (
              <p className="error" role="alert">
                {st.notice}
              </p>
            )}
            <ol className="steps">
              <li>Sur l'iPhone, glissez depuis le coin supérieur droit pour ouvrir le Centre de contrôle.</li>
              <li>
                Touchez <b>Recopie de l'écran</b>, puis <b>{st.name}</b>.
              </li>
              <li>Saisissez le code ci-contre. {st.inApp ? "L'écran de l'iPhone s'affiche ici, en grand, avec le son." : "L'écran s'affiche dans une nouvelle fenêtre."}</li>
            </ol>
            <p className="muted">
              L'ordinateur n'apparaît pas sur l'iPhone ? Vérifiez que les deux sont sur le même Wi-Fi (pas un réseau « invité »), puis
              arrêtez et réactivez la réception.
            </p>
            <div className="row">
              <button className="btn ghost" onClick={() => void mm.airplayStop()}>
                Arrêter la réception
              </button>
              <button className="btn ghost" onClick={() => void mm.openLogs()}>
                Ouvrir les journaux
              </button>
            </div>
          </div>
          <div className="airplay-code">
            <p className="label">Code AirPlay</p>
            <p className="pin" data-testid="airplay-pin">
              {st.pin}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function SourcePicker({ sources, onPick, onRefresh, onCancel }: { sources: CaptureSource[] | null; onPick: (s: CaptureSource) => void; onRefresh: () => void; onCancel: () => void }) {
  if (!sources) return <p className="muted">Recherche des écrans…</p>;
  const screens = sources.filter((s) => s.kind === "screen");
  const windows = sources.filter((s) => s.kind === "window");
  return (
    <div>
      {[["Écrans", screens], ["Fenêtres", windows]].map(([label, list]) =>
        (list as CaptureSource[]).length ? (
          <div key={label as string}>
            <p className="label">{label as string}</p>
            <div className="sources">
              {(list as CaptureSource[]).map((s) => (
                <button key={s.id} className="source" onClick={() => onPick(s)}>
                  <img src={s.thumbnail} alt="" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null,
      )}
      {sources.length === 0 && <p className="muted">Aucun écran disponible.</p>}
      <div className="row">
        <button className="btn ghost" onClick={onRefresh}>
          <Svg d={Icon.refresh} size={16} /> Actualiser
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function WaitingCard({ state, onNewPin, onStop }: { state: Extract<HostState, { s: "waiting" }>; onNewPin: () => void; onStop: () => void }) {
  const left = useCountdown(state.expiresAt);
  const invalid = state.pinState ?? (left === 0 ? "expired" : undefined);
  return (
    <div className="waiting">
      <p className="label">Code de connexion</p>
      <p className={`pin ${invalid ? "invalid" : ""}`} data-testid="pin" aria-live="polite">
        {state.pin.slice(0, 3)} {state.pin.slice(3)}
      </p>
      {invalid ? (
        <p className="warn">{invalid === "locked" ? "Trop d'essais incorrects : ce code est bloqué." : "Ce code a expiré."}</p>
      ) : (
        <div className="countdown" aria-label={`Expire dans ${left} secondes`}>
          <span style={{ width: `${(left / 120) * 100}%` }} />
        </div>
      )}
      <dl className="kv">
        <dt>Adresse</dt>
        <dd className="mono">{state.addresses.length ? state.addresses.map((a) => `${a}:${state.port}`).join(" · ") : `port ${state.port}`}</dd>
        <dt>Validité</dt>
        <dd>{invalid ? "—" : `${left} s · usage unique`}</dd>
      </dl>
      <div className="row">
        <button className="btn ghost" onClick={onNewPin}>
          <Svg d={Icon.refresh} size={16} /> Nouveau code
        </button>
        <button className="btn ghost" onClick={onStop}>
          Arrêter
        </button>
      </div>
    </div>
  );
}

function SharingCard({ state, recording, onStop }: { state: Extract<HostState, { s: "sharing" }>; recording: boolean; onStop: () => void }) {
  const elapsed = useElapsed(state.since);
  return (
    <div className="sharing">
      <p className="live">
        <span className="dot live-dot" /> En direct
      </p>
      <p className="big">
        <b>{state.peer}</b> voit votre écran
      </p>
      <p className="mono muted">{elapsed}</p>
      {recording && <p className="warn">⏺ {state.peer} enregistre votre écran.</p>}
      <button className="btn danger" onClick={onStop}>
        Arrêter le partage
      </button>
    </div>
  );
}

function Discovered({ onPick }: { onPick: (t: { name: string; host: string; port: number }) => void }) {
  const [list, setList] = useState<DiscoveredDevice[]>([]);
  useEffect(() => {
    const off = mm.onDevices(setList);
    void mm.discoverStart();
    return () => {
      off();
      void mm.discoverStop();
    };
  }, []);
  return (
    <div>
      <p className="label">Sur ce réseau</p>
      {list.length === 0 ? (
        <p className="muted small" data-testid="no-devices">
          Aucun ordinateur détecté. Lancez « Partager cet écran » sur l'autre ordinateur, ou saisissez son adresse ci-dessous.
        </p>
      ) : (
        <ul className="device-list">
          {list.map((d) => (
            <li key={d.id}>
              <span className="dot ok" />
              <span className="grow">
                {d.name}
                <span className="mono muted small"> {d.host}</span>
              </span>
              <button className="btn ghost sm" onClick={() => onPick({ name: d.name, host: d.host, port: d.port })}>
                Se connecter
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManualConnect({ defaultPort, onConnect }: { defaultPort: number; onConnect: (t: { name: string; host: string; port: number }) => void }) {
  const [addr, setAddr] = useState("");
  const [port, setPort] = useState(String(defaultPort));
  const valid = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/.test(addr.trim()) && Number(port) > 0 && Number(port) < 65536;
  return (
    <form
      className="manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConnect({ name: addr.trim(), host: addr.trim(), port: Number(port) });
      }}
    >
      <p className="label">Par adresse</p>
      <div className="row">
        <input aria-label="Adresse IP" placeholder="192.168.1.20" value={addr} onChange={(e) => setAddr(e.target.value)} className="grow mono" />
        <input aria-label="Port" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))} className="port mono" inputMode="numeric" />
        <button className="btn primary" disabled={!valid}>
          Continuer
        </button>
      </div>
    </form>
  );
}

function PinDialog({ target, error, busy, onSubmit, onCancel }: { target: { name: string; host: string; port: number }; error?: string; busy: boolean; onSubmit: (pin: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  return (
    <Modal title={`Se connecter à ${target.name}`} onClose={busy ? undefined : onCancel}>
      <p className="muted">Saisissez le code à 6 chiffres affiché sur l'autre ordinateur.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.length === 6) onSubmit(pin);
        }}
      >
        <input
          className="pin-input mono"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Code à 6 chiffres"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={busy}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy && <p className="muted small">En attente de l'accord de l'autre ordinateur…</p>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
          <button className="btn primary" disabled={pin.length !== 6 || busy}>
            Se connecter
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConsentDialog({ request, onAnswer }: { request: Extract<HostEvent, { type: "request" }>; onAnswer: (accept: boolean) => void }) {
  const [until] = useState(() => Date.now() + 30_000);
  const left = useCountdown(until);
  useEffect(() => {
    if (left === 0) onAnswer(false);
  }, [left, onAnswer]);
  return (
    <Modal title="Demande de connexion">
      <p>
        <b>{request.name}</b> <span className="mono muted">({request.address.replace("::ffff:", "")})</span> a saisi le bon code et demande à voir
        votre écran.
      </p>
      <p className="muted small">Sans réponse, la demande sera refusée dans {left} s.</p>
      <div className="row end">
        <button className="btn ghost" onClick={() => onAnswer(false)}>
          Refuser
        </button>
        <button className="btn primary" onClick={() => onAnswer(true)} autoFocus>
          Autoriser
        </button>
      </div>
    </Modal>
  );
}

function ViewerScreen({ state, pc, onLeave, onKill, toast }: { state: Extract<ViewerState, { s: "watching" }>; pc: RTCPeerConnection | null; onLeave: () => void; onKill: () => void; toast: (t: string, tone?: Toast["tone"]) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [fit, setFit] = useState(true);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const elapsed = useElapsed(state.since);

  useEffect(() => {
    if (video.current) video.current.srcObject = state.stream;
  }, [state.stream]);
  useEffect(() => (pc ? watchStats(pc, setStats) : undefined), [pc]);

  async function screenshot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) return;
    const path = await window.mm.saveFile("png", await blob.arrayBuffer());
    if (path) toast("Capture enregistrée.", "ok");
  }

  function toggleRecord() {
    if (rec) {
      rec.stop();
      return;
    }
    const chunks: Blob[] = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const r = new MediaRecorder(state.stream, { mimeType: mime });
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      setRec(null);
      void window.mm.viewerSetRecording(false);
      const path = await window.mm.saveFile("webm", await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
      toast(path ? "Enregistrement sauvegardé." : "Enregistrement abandonné.", path ? "ok" : undefined);
    };
    r.start(1000);
    setRec(r);
    void window.mm.viewerSetRecording(true); // the other side is always told
  }

  return (
    <div className="viewer">
      <header className="viewer-bar">
        <span className="live">
          <span className="dot live-dot" />
        </span>
        <b>{state.hostName}</b>
        <span className="mono muted small">{elapsed}</span>
        <span className="mono muted small stats" data-testid="stats">
          {stats && stats.width ? `${stats.width}×${stats.height} · ${stats.fps} i/s · ${(stats.kbps / 1000).toFixed(1)} Mb/s${stats.rttMs !== null ? ` · ${stats.rttMs} ms` : ""}${stats.lossPct > 0.5 ? ` · ${stats.lossPct.toFixed(1)} % perdus` : ""}` : "Mesure en cours…"}
        </span>
        <span className="grow" />
        <button className="icon-btn" onClick={() => void screenshot()} title="Capture d'écran" aria-label="Capture d'écran">
          <Svg d={Icon.camera} />
        </button>
        <button className={`icon-btn ${rec ? "recording" : ""}`} onClick={toggleRecord} title={rec ? "Arrêter l'enregistrement" : "Enregistrer"} aria-label={rec ? "Arrêter l'enregistrement" : "Enregistrer"} aria-pressed={!!rec}>
          <span className={`rec-dot ${rec ? "on" : ""}`} />
        </button>
        <button className="btn ghost sm" onClick={() => setFit((f) => !f)} aria-pressed={!fit}>
          {fit ? "Ajusté" : "100 %"}
        </button>
        <button className="icon-btn" onClick={() => void stage.current?.requestFullscreen()} title="Plein écran" aria-label="Plein écran">
          <Svg d={Icon.full} />
        </button>
        <button className="btn ghost sm" onClick={onLeave}>
          Déconnecter
        </button>
        <button className="btn danger sm" onClick={onKill} title="Ctrl+Alt+K">
          Tout couper
        </button>
      </header>
      <div className={`stage ${fit ? "fit" : "actual"}`} ref={stage}>
        <video ref={video} autoPlay playsInline muted />
      </div>
    </div>
  );
}

function HistoryView() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  useEffect(() => void mm.history().then(setItems), []);
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  const dur = (a: string, b: string | null) => {
    if (!b) return "—";
    const s = Math.round((Date.parse(b) - Date.parse(a)) / 1000);
    return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
  };
  if (!items) return null;
  if (items.length === 0) return <p className="muted empty">Aucune session pour le moment.</p>;
  return (
    <div>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Rôle</th>
            <th>Appareil</th>
            <th>Adresse</th>
            <th>Durée</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h) => (
            <tr key={h.id}>
              <td>{fmt.format(new Date(h.startedAt))}</td>
              <td>{h.role === "host" ? "Partagé" : "Regardé"}</td>
              <td>{h.peer}</td>
              <td className="mono">{h.address.replace("::ffff:", "")}</td>
              <td>{dur(h.startedAt, h.endedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="btn ghost"
        onClick={async () => {
          await mm.clearHistory();
          setItems([]);
        }}
      >
        Effacer l'historique
      </button>
    </div>
  );
}

function SettingsView({ settings, onChange, hostActive }: { settings: Settings; onChange: (s: Settings) => void; hostActive: boolean }) {
  const [name, setName] = useState(settings.deviceName);
  const [port, setPort] = useState(String(settings.port));
  const save = async (patch: Partial<Settings>) => onChange(await mm.setSettings(patch));

  function Choice<K extends keyof Settings>({ k, label, options }: { k: K; label: string; options: [Settings[K], string][] }) {
    return (
      <fieldset className="field">
        <legend>{label}</legend>
        <div className="segmented">
          {options.map(([v, l]) => (
            <label key={String(v)} className={settings[k] === v ? "on" : ""}>
              <input type="radio" name={k} checked={settings[k] === v} onChange={() => void save({ [k]: v } as Partial<Settings>)} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="settings">
      <section>
        <h2>Cet ordinateur</h2>
        <label className="field">
          <span>Nom affiché aux autres appareils</span>
          <input value={name} maxLength={64} onChange={(e) => setName(e.target.value)} onBlur={() => void save({ deviceName: name })} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.discoverable} onChange={(e) => void save({ discoverable: e.target.checked })} />
          <span>Être visible sur le réseau local pendant un partage</span>
        </label>
      </section>
      <section>
        <h2>Apparence</h2>
        <Choice k="theme" label="Thème" options={[["auto", "Automatique"], ["light", "Clair"], ["dark", "Sombre"]]} />
      </section>
      <section>
        <h2>Qualité du partage</h2>
        <Choice k="maxHeight" label="Résolution maximale" options={[[720, "720p"], [1080, "1080p"], [1440, "1440p"], [0, "Native"]]} />
        <Choice k="fps" label="Images par seconde" options={[[30, "30"], [60, "60"]]} />
      </section>
      <section>
        <h2>Réseau</h2>
        <label className="field">
          <span>Port d'écoute {hostActive && <em className="muted small">(pris en compte au prochain partage)</em>}</span>
          <input
            className="mono port"
            value={port}
            inputMode="numeric"
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
            onBlur={() => void save({ port: Number(port) }).then(() => setPort(String(settings.port)))}
          />
        </label>
        <p className="muted small">Autorisez ce port dans le pare-feu de l'ordinateur qui partage son écran.</p>
      </section>
      <section>
        <h2>Mises à jour</h2>
        <label className="toggle">
          <input type="checkbox" checked={settings.autoUpdate} onChange={(e) => void save({ autoUpdate: e.target.checked })} />
          <span>Rechercher et télécharger les mises à jour automatiquement (au démarrage, puis toutes les heures)</span>
        </label>
        <p className="muted small">La nouvelle version s'installe au prochain redémarrage de MansoMirror, ou immédiatement si vous cliquez sur « Redémarrer ».</p>
        <button className="btn ghost sm" onClick={() => void mm.updateCheck()}>
          Rechercher maintenant
        </button>
      </section>
      <section>
        <h2>Sécurité</h2>
        <p className="muted small">
          Chaque connexion exige un code à usage unique valable 2 minutes (5 essais au maximum), puis votre accord. Le flux est chiffré de bout en
          bout et ne passe par aucun serveur. Raccourci « tout couper » : Ctrl+Alt+K.
        </p>
      </section>
    </div>
  );
}

/** Sidebar: update progress and the restart button. */
function UpdateBox() {
  const [st, setSt] = useState<UpdateState | null>(null);
  useEffect(() => {
    void mm.updateState().then(setSt);
    return mm.onUpdate(setSt);
  }, []);
  if (!st) return null;
  if (st.status === "downloading")
    return (
      <div className="update-box" role="status">
        <p>Mise à jour {st.version}</p>
        <div className="countdown">
          <span style={{ width: `${st.percent}%` }} />
        </div>
        <p className="muted small">Téléchargement… {st.percent} %</p>
      </div>
    );
  if (st.status === "ready")
    return (
      <div className="update-box ready" role="status" data-testid="update-ready">
        <p>
          <b>Version {st.version}</b> prête.
        </p>
        <button className="btn primary sm" onClick={() => void mm.updateInstall()}>
          Redémarrer
        </button>
        <p className="muted small">Sinon, elle s'installera à la prochaine fermeture.</p>
      </div>
    );
  return null;
}
