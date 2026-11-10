"use client";

import { motion } from "motion/react";
import type { FeatureId } from "@/content/site";
import { PhoneScreen } from "./PhoneScreen";

export interface StreamSettings {
  resolution: "720p" | "1080p" | "1440p";
  fps: 30 | 60;
  quality: "eco" | "balanced" | "max";
  transport: "wifi" | "usb";
  scale: "fit" | "100";
}

export const defaultSettings: StreamSettings = {
  resolution: "1080p",
  fps: 60,
  quality: "balanced",
  transport: "wifi",
  scale: "fit",
};

/** Indicative targets used by the illustration only — real values are measured by the app. */
export function estimate(s: StreamSettings) {
  const pixels = { "720p": 0.92, "1080p": 2.07, "1440p": 3.69 }[s.resolution];
  const bpp = { eco: 0.05, balanced: 0.08, max: 0.13 }[s.quality];
  const mbps = (pixels * s.fps * bpp).toFixed(1).replace(".", ",");
  const latency = (s.transport === "usb" ? 28 : 45) + (s.fps === 30 ? 12 : 0) + (s.resolution === "1440p" ? 6 : 0);
  return { mbps, latency };
}

function Region({ id, active, className, children }: { id: FeatureId | FeatureId[]; active?: FeatureId | null; className?: string; children: React.ReactNode }) {
  const ids = Array.isArray(id) ? id : [id];
  const on = active != null && ids.includes(active);
  return (
    <div className={`relative ${className ?? ""}`}>
      {children}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 rounded-[10px] ring-2 ring-accent"
        initial={false}
        animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.97 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}

const icon = {
  camera: "M4 8h3l2-2h6l2 2h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  sound: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
};

function ToolIcon({ d, label }: { d: string; label: string }) {
  return (
    <span className="grid size-7 place-items-center rounded-sm text-muted" title={label}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </span>
  );
}

/**
 * Drawing of the planned MansoMirror Desktop window. Not a live app:
 * the device shown is an illustration, and figures are labelled as estimates.
 */
export function DesktopWindow({
  highlight = null,
  settings = defaultSettings,
  recording = false,
  compact = false,
}: {
  highlight?: FeatureId | null;
  settings?: StreamSettings;
  recording?: boolean;
  compact?: boolean;
}) {
  const { mbps, latency } = estimate(settings);
  const blur = settings.quality === "eco" ? 0.4 : 0;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface text-[13px] shadow-lg" role="img" aria-label="Illustration de l'application MansoMirror Desktop recopiant l'écran d'un téléphone">
      {/* Title bar */}
      <div className="flex h-9 items-center gap-2 border-b border-line bg-raised px-3">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 font-display text-xs font-semibold text-muted">MansoMirror</span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        {!compact && (
          <Region id={["iphone", "android"]} active={highlight} className="hidden w-40 shrink-0 border-r border-line p-3 sm:block">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-subtle">Téléphones</p>
            <div className="flex items-center gap-2 rounded-md bg-accent-soft px-2 py-1.5">
              <span className="live-dot size-1.5 rounded-full bg-live" />
              <span className="truncate font-medium">Pixel · USB</span>
            </div>
            <div className="mt-1 flex items-center gap-2 px-2 py-1.5 text-muted">
              <span className="size-1.5 rounded-full bg-ok-ink" />
              <span className="truncate">Galaxy · Wi-Fi</span>
            </div>
            <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-wider text-subtle">iPhone (AirPlay)</p>
            <div className="rounded-md border border-dashed border-line-strong px-2 py-1.5 text-center font-mono tracking-[0.2em] text-muted">
              4821
            </div>
          </Region>
        )}

        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="flex h-11 items-center gap-1 border-b border-line px-2">
            <Region id={["android", "iphone"]} active={highlight}>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-xs">
                <span className={`size-1.5 rounded-full ${settings.transport === "usb" ? "bg-warn-ink" : "bg-ok-ink"}`} />
                {settings.transport === "usb" ? "USB" : "Wi-Fi"}
              </span>
            </Region>
            <Region id="quality" active={highlight} className="ml-2 hidden min-w-0 md:block">
              <span className="block truncate font-mono text-[11px] text-subtle" title="Estimation">
                {settings.resolution} · {settings.fps} i/s · ~{mbps} Mb/s · ~{latency} ms
              </span>
            </Region>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <Region id="screenshot" active={highlight}>
                <ToolIcon d={icon.camera} label="Capture d'écran" />
              </Region>
              <Region id="record" active={highlight}>
                <span className="grid size-7 place-items-center" title="Enregistrer">
                  <span className={`size-3 rounded-full ${recording ? "live-dot bg-live" : "border-2 border-live"}`} />
                </span>
              </Region>
              <Region id="sound" active={highlight}>
                <ToolIcon d={icon.sound} label="Son" />
              </Region>
              <ToolIcon d={icon.full} label="Plein écran" />
              <span className="ml-1 hidden whitespace-nowrap rounded-sm bg-live px-2 py-1 text-[11px] font-semibold text-white sm:inline">Couper</span>
            </div>
          </div>

          {/* Viewport */}
          <div className="relative grid place-items-center bg-bg-subtle py-6" style={{ minHeight: compact ? 260 : 340 }}>
            <Region id="mirror" active={highlight} className="rounded-[18px]">
              <motion.div
                className="relative overflow-hidden rounded-[18px] border-[5px] border-[#1B1B19] text-[11px] shadow-md"
                animate={{ width: settings.scale === "100" ? 176 : 150 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ aspectRatio: "9 / 19" }}
              >
                <PhoneScreen blur={blur} />
                {/* Remote control cursor */}
                <Region id="control" active={highlight} className="!absolute left-[58%] top-[63%]">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#111110" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </Region>
              </motion.div>
            </Region>
            {recording && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] text-live-ink shadow-sm">
                <span className="live-dot size-1.5 rounded-full bg-live" /> REC
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
