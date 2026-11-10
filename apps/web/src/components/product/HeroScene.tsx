"use client";

import { motion, useReducedMotion } from "motion/react";
import { LivePhoneScreen } from "./LivePhoneScreen";

/** Mirroring delay shown in the scene (seconds). */
const LAG = 0.12;

/**
 * Hero scene: a phone running an app, mirrored live in the MansoMirror window
 * on a laptop. Everything scales with the scene width (container query units).
 */
export function HeroScene() {
  const reduce = useReducedMotion();
  const enter = (delay: number, y = 18) =>
    reduce ? {} : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.2, 0, 0, 1] as const } };

  return (
    <div className="relative mx-auto w-full max-w-[620px] [container-type:inline-size]" aria-hidden="true">
      {/* soft cobalt glow behind the devices */}
      <div className="absolute left-[8%] right-[2%] top-[6%] bottom-[10%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--mm-accent)_28%,transparent),transparent)] blur-2xl" />

      <div className="relative" style={{ aspectRatio: "620 / 440" }}>
        {/* ---------------- Laptop ---------------- */}
        <motion.div className="absolute left-0 top-[4%] w-[84%]" {...enter(0.05)}>
          {/* lid */}
          <div className="relative rounded-t-[2.4cqw] rounded-b-[0.6cqw] bg-[#0E0E10] p-[1.9cqw] pb-[2.4cqw] shadow-[0_2cqw_5cqw_-1cqw_rgba(15,20,50,.45)] ring-1 ring-[#2B2B30]">
            <span className="absolute left-1/2 top-[0.55cqw] size-[0.75cqw] -translate-x-1/2 rounded-full bg-[#1E1E22] ring-1 ring-[#2E2E33]" />
            <div className="relative overflow-hidden rounded-[0.7cqw]" style={{ aspectRatio: "16 / 10" }}>
              {/* wallpaper */}
              <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_10%,#5C7BFF_0%,transparent_55%),radial-gradient(90%_80%_at_95%_95%,#8B5CF6_0%,transparent_60%),linear-gradient(160deg,#16226B,#0B1033)]" />
              {/* menu bar */}
              <div className="absolute inset-x-0 top-0 flex h-[5.5%] items-center gap-[1.4cqw] bg-black/25 px-[1.6cqw] text-[1.05cqw] font-medium text-white/85">
                <span className="font-semibold">MansoMirror</span>
                <span className="text-white/60">Fichier</span>
                <span className="text-white/60">Affichage</span>
                <span className="ml-auto text-white/70">10:24</span>
              </div>

              {/* app window */}
              <div className="absolute left-[5%] right-[24%] top-[11%] bottom-[7%] overflow-hidden rounded-[1cqw] bg-[#15161B] shadow-[0_1.5cqw_4cqw_rgba(0,0,0,.5)] ring-1 ring-white/10">
                <div className="flex h-[9%] items-center gap-[0.6cqw] border-b border-white/10 bg-[#1C1D23] px-[1.2cqw]">
                  <span className="size-[0.9cqw] rounded-full bg-[#FF5F57]" />
                  <span className="size-[0.9cqw] rounded-full bg-[#FEBC2E]" />
                  <span className="size-[0.9cqw] rounded-full bg-[#28C840]" />
                  <span className="ml-[1.2cqw] text-[1.05cqw] font-semibold text-white/80">Téléphone de Manso</span>
                  <span className="ml-auto inline-flex items-center gap-[0.5cqw] rounded-full bg-white/8 px-[0.9cqw] py-[0.25cqw] text-[0.95cqw] text-white/85">
                    <span className="live-dot size-[0.7cqw] rounded-full bg-[#FF7A5C]" />
                    En direct · Wi-Fi · 34 ms
                  </span>
                </div>
                <div className="relative flex h-[91%] items-center justify-center bg-[radial-gradient(60%_80%_at_50%_50%,#20222B,#121318)]">
                  {/* mirrored phone */}
                  <div className="relative h-[90%] overflow-hidden rounded-[1.5cqw] ring-[0.35cqw] ring-[#050506] text-[0.95cqw]" style={{ aspectRatio: "9 / 19.5" }}>
                    <LivePhoneScreen lag={LAG} />
                  </div>
                  {/* cursor mirroring the tap */}
                  <svg className="mm-anim mm-cursor absolute left-[51%] top-[31%] w-[1.9cqw]" style={{ animationDelay: `${LAG}s` }} viewBox="0 0 24 24">
                    <path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  {/* side toolbar */}
                  <div className="absolute right-[3%] top-1/2 flex -translate-y-1/2 flex-col gap-[0.8cqw] rounded-[0.9cqw] bg-white/6 p-[0.7cqw] ring-1 ring-white/10">
                    {["M4 8h3l2-2h6l2 2h3v11H4z", "M12 6v12M6 12h12", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"].map((p) => (
                      <svg key={p} viewBox="0 0 24 24" className="w-[1.5cqw]" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={p} />
                      </svg>
                    ))}
                    <span className="mx-auto size-[1.2cqw] rounded-full border-[0.25cqw] border-[#FF7A5C]" />
                  </div>
                </div>
              </div>

              {/* glass glare */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.09)_0%,rgba(255,255,255,.02)_35%,transparent_36%)]" />
            </div>
          </div>
          {/* base */}
          <div className="relative mx-[-5%] h-[2.2cqw] rounded-b-[1.6cqw] bg-[linear-gradient(180deg,#E3E4E8_0%,#B9BBC2_55%,#8E9098_100%)] shadow-[0_1.4cqw_2.4cqw_-0.6cqw_rgba(15,20,50,.45)]">
            <span className="absolute left-1/2 top-0 h-[45%] w-[16%] -translate-x-1/2 rounded-b-[0.8cqw] bg-[#9FA1A8]" />
          </div>
        </motion.div>

        {/* ---------------- Link between devices ---------------- */}
        {!reduce && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 440" fill="none">
            <defs>
              <linearGradient id="mm-beam" x1="1" x2="0">
                <stop offset="0" stopColor="var(--mm-accent)" stopOpacity="0" />
                <stop offset=".5" stopColor="var(--mm-accent)" stopOpacity=".7" />
                <stop offset="1" stopColor="var(--mm-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path id="mm-link" d="M512 250 C 470 205, 440 200, 400 214" stroke="url(#mm-beam)" strokeWidth="2" strokeDasharray="4 6" className="mm-anim mm-dash" />
            {[0, 0.6, 1.2].map((b) => (
              <circle key={b} r="3.2" fill="var(--mm-accent)">
                <animateMotion dur="1.8s" begin={`${b}s`} repeatCount="indefinite" path="M512 250 C 470 205, 440 200, 400 214" />
                <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${b}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </svg>
        )}

        {/* ---------------- Phone ---------------- */}
        <motion.div className="absolute bottom-[1%] right-[1%] w-[27%]" {...enter(0.25, 28)}>
          <div className="mm-anim mm-float">
            <div className="relative rounded-[4.4cqw] bg-[linear-gradient(145deg,#3A3B42,#121216_40%,#24252B)] p-[0.75cqw] shadow-[0_3cqw_5cqw_-1.5cqw_rgba(10,15,45,.6),inset_0_0_0_0.15cqw_rgba(255,255,255,.12)]">
              {/* side buttons */}
              <span className="absolute -left-[0.35cqw] top-[22%] h-[7%] w-[0.4cqw] rounded-l-full bg-[#2A2B31]" />
              <span className="absolute -left-[0.35cqw] top-[32%] h-[11%] w-[0.4cqw] rounded-l-full bg-[#2A2B31]" />
              <span className="absolute -right-[0.35cqw] top-[28%] h-[14%] w-[0.4cqw] rounded-r-full bg-[#2A2B31]" />
              <div className="relative overflow-hidden rounded-[3.7cqw] text-[1.95cqw]" style={{ aspectRatio: "9 / 19.5" }}>
                <LivePhoneScreen />
                {/* camera pill */}
                <span className="absolute left-1/2 top-[1.6%] h-[3.2%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
                {/* glass reflection */}
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,.14)_0%,rgba(255,255,255,0)_38%)]" />
              </div>
            </div>
          </div>
          {/* ground shadow */}
          <div className="mx-auto mt-[1.2cqw] h-[1.6cqw] w-[75%] rounded-[50%] bg-black/25 blur-[0.8cqw]" />
        </motion.div>
      </div>
    </div>
  );
}
