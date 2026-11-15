import { useCallback, useEffect, useState } from "react";
import type { MansoApi, MirrorTarget } from "../shared/api.ts";
import { AndroidScreen } from "./android-ui.tsx";
import { IPhoneScreen } from "./iphone-ui.tsx";
import { Toasts, type Toast } from "./ui.tsx";

const mm = (window as unknown as { mm: MansoApi }).mm;

export function parseMirrorHash(hash: string): MirrorTarget | null {
  const m = /^#mirror=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const t = JSON.parse(decodeURIComponent(m[1])) as MirrorTarget;
    if (t.kind === "iphone" && typeof t.name === "string") return t;
    if (t.kind === "android" && typeof t.serial === "string") return t;
  } catch {}
  return null;
}

/** The floating window: only the phone, its frame and its toolbar. */
export function MirrorWindow({ target }: { target: MirrorTarget }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone?: Toast["tone"]) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  useEffect(() => mm.onKilled(() => void mm.windowAction("close")), []);
  const close = () => void mm.windowAction("close");

  return (
    <>
      {target.kind === "iphone" ? (
        <IPhoneScreen name={target.name} toast={toast} floating onKill={() => void mm.killAll()} onStop={() => void mm.airplayStop()} />
      ) : (
        <AndroidScreen
          device={{ serial: target.serial, model: target.model, transport: target.transport, state: "device" }}
          toast={toast}
          floating
          onKill={() => void mm.killAll()}
          onClose={() => close()}
        />
      )}
      <Toasts items={toasts} />
    </>
  );
}
