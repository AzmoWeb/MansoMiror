"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { HeroScene } from "../product/HeroScene";

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
        <HeroScene />
      </div>
    </section>
  );
}
