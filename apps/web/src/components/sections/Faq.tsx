"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { faq } from "@/content/site";
import { Reveal } from "../Reveal";

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-5 text-left font-display text-lg font-semibold"
        >
          {q}
          <motion.span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-muted"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg viewBox="0 0 12 12" width="10" height="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
          >
            <p className="max-w-2xl pb-6 leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-line py-20 md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <Reveal>
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Questions fréquentes.</h2>
        </Reveal>
        <div className="border-t border-line">
          {faq.map((f, i) => (
            <Item key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
