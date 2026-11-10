"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PhoneScreen } from "../product/PhoneScreen";

/** Phone → laptop illustration. The mirrored screen "forms" by sweeping out from the link axis. */
function HeroIllustration() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-hidden="true">
      <div className="grid-paper absolute -inset-10 opacity-60" />
      <div className="relative flex items-end gap-5 sm:gap-8">
        {/* Laptop */}
        <div className="flex-1">
          <div className="rounded-t-[14px] border border-line-strong bg-[#1B1B19] p-[3.5%] shadow-lg">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[4px] bg-bg-subtle">
              <div className="flex h-[9%] items-center gap-1 border-b border-line bg-raised px-[2%]">
                <span className="size-1.5 rounded-full bg-line-strong" />
                <span className="size-1.5 rounded-full bg-line-strong" />
                <span className="size-1.5 rounded-full bg-line-strong" />
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] text-live-ink">
                  <span className="live-dot size-1 rounded-full bg-live" /> EN DIRECT
                </span>
              </div>
              <div className="grid h-[91%] place-items-center">
                <motion.div
                  className="h-[86%] overflow-hidden rounded-[9px] border-[3px] border-[#1B1B19] text-[7px]"
                  style={{ aspectRatio: "9 / 19", originX: 1 }}
                  initial={reduce ? false : { clipPath: "inset(0 0 0 100%)" }}
                  animate={{ clipPath: "inset(0 0 0 0%)" }}
                  transition={{ duration: 0.9, delay: 0.7, ease: [0.2, 0, 0, 1] }}
                >
                  <PhoneScreen />
                </motion.div>
              </div>
            </div>
          </div>
          <div className="mx-[-4%] h-3 rounded-b-[10px] border border-t-0 border-line-strong bg-line" />
        </div>

        {/* Link axis */}
        <div className="absolute bottom-[22%] left-[62%] right-[22%] hidden h-px bg-line-strong sm:block">
          {!reduce &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute -top-[2px] size-[5px] rounded-full bg-accent"
                initial={{ left: "100%", opacity: 0 }}
                animate={{ left: "0%", opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, delay: 0.4 + i * 0.53, repeat: Infinity, ease: "linear" }}
              />
            ))}
        </div>

        {/* Phone */}
        <motion.div
          className="w-[26%] shrink-0"
          initial={reduce ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          <div className="overflow-hidden rounded-[20px] border-[5px] border-[#1B1B19] text-[9px] shadow-lg" style={{ aspectRatio: "9 / 19" }}>
            <PhoneScreen />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-14 md:pb-28 md:pt-20">
      <div className="container-page grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            Recopie d'écran · Contrôle à distance
          </motion.p>
          <motion.h1
            className="mt-4 font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
          >
            Votre écran.
            <br />
            Partout.
            <br />
            <span className="text-accent-ink">En toute simplicité.</span>
          </motion.h1>
          <motion.p
            className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.2, 0, 0, 1] }}
          >
            MansoMirror vous permet de partager et de contrôler vos appareils en quelques secondes. Profitez d'une expérience
            fluide entre votre smartphone et votre ordinateur.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            <Link href="/#telecharger" className="btn btn-primary">
              Télécharger gratuitement
            </Link>
            <Link href="/#fonctionnalites" className="btn btn-ghost">
              Découvrir MansoMirror
            </Link>
          </motion.div>
          <p className="mt-5 text-sm text-subtle">En développement — bêta pour Windows, macOS et Linux ; application mobile à venir.</p>
        </div>
        <HeroIllustration />
      </div>
    </section>
  );
}
