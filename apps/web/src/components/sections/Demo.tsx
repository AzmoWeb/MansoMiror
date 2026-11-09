"use client";

import { useState } from "react";
import { DesktopWindow, defaultSettings, type StreamSettings } from "../product/DesktopWindow";
import { Reveal } from "../Reveal";

type Option<K extends keyof StreamSettings> = { value: StreamSettings[K]; label: string };

function Segmented<K extends keyof StreamSettings>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: K;
  label: string;
  value: StreamSettings[K];
  options: Option<K>[];
  onChange: (v: StreamSettings[K]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="inline-flex rounded-md border border-line p-0.5" role="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`cursor-pointer rounded-[5px] px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--mm-focus-ring)] ${
                on ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              <input type="radio" name={name} className="sr-only" checked={on} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Demo() {
  const [s, setS] = useState<StreamSettings>(defaultSettings);
  const [recording, setRecording] = useState(false);
  const set = <K extends keyof StreamSettings>(k: K) => (v: StreamSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  return (
    <section id="demo" className="border-t border-line py-20 md:py-28">
      <div className="container-page">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Démonstration</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Réglez la session comme vous l'entendez.</h2>
          <p className="mt-4 text-muted">
            Maquette interactive de MansoMirror Desktop. Changez les réglages pour voir leur effet attendu sur le débit et la
            latence.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <DesktopWindow settings={s} recording={recording} />
            <p className="mt-3 text-xs text-subtle" data-testid="demo-disclaimer">
              Maquette : aucun appareil n'est connecté. Débit et latence sont des estimations, pas des mesures.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <Segmented name="transport" label="Connexion" value={s.transport} onChange={set("transport")}
              options={[{ value: "wifi", label: "Wi-Fi" }, { value: "usb", label: "USB" }]} />
            <Segmented name="resolution" label="Résolution" value={s.resolution} onChange={set("resolution")}
              options={[{ value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }, { value: "1440p", label: "1440p" }]} />
            <Segmented name="fps" label="Images par seconde" value={s.fps} onChange={set("fps")}
              options={[{ value: 30, label: "30" }, { value: 60, label: "60" }]} />
            <Segmented name="quality" label="Qualité vidéo" value={s.quality} onChange={set("quality")}
              options={[{ value: "eco", label: "Économe" }, { value: "balanced", label: "Équilibrée" }, { value: "max", label: "Maximale" }]} />
            <Segmented name="scale" label="Affichage" value={s.scale} onChange={set("scale")}
              options={[{ value: "fit", label: "Ajusté" }, { value: "100", label: "100 %" }]} />
            <button type="button" onClick={() => setRecording((r) => !r)} className="btn btn-ghost self-start" aria-pressed={recording}>
              <span className={`size-2.5 rounded-full bg-live ${recording ? "live-dot" : ""}`} />
              {recording ? "Arrêter l'enregistrement" : "Simuler un enregistrement"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
