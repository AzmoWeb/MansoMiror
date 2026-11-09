"use client";

import { useState } from "react";
import { features, type FeatureId } from "@/content/site";
import { DesktopWindow } from "../product/DesktopWindow";
import { Reveal } from "../Reveal";

/**
 * Features are presented on the product itself: hovering/focusing an item
 * highlights the part of the desktop window that provides it.
 */
export function Features() {
  const [active, setActive] = useState<FeatureId>("mirror");

  return (
    <section id="fonctionnalites" className="border-t border-line py-20 md:py-28">
      <div className="container-page">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Fonctionnalités</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Tout ce qu'il faut, à sa place.</h2>
          <p className="mt-4 text-muted">Sélectionnez une fonctionnalité pour voir où elle se trouve dans l'application.</p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <ol className="divide-y divide-line border-y border-line">
            {features.map((f, i) => {
              const on = f.id === active;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(f.id)}
                    onFocus={() => setActive(f.id)}
                    onClick={() => setActive(f.id)}
                    aria-pressed={on}
                    className="group grid w-full grid-cols-[2.25rem_1fr] gap-x-2 py-4 text-left"
                  >
                    <span className={`font-mono text-xs leading-6 transition-colors ${on ? "text-accent-ink" : "text-subtle"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={`font-display text-lg font-semibold transition-colors ${on ? "text-ink" : "text-muted group-hover:text-ink"}`}>
                      {f.title}
                    </span>
                    <span
                      className={`col-start-2 grid text-[0.9375rem] leading-relaxed text-muted transition-[grid-template-rows,opacity] duration-300 ${
                        on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <span className="overflow-hidden">
                        <span className="block pt-1.5">{f.body}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <DesktopWindow highlight={active} recording={active === "record"} />
            <p className="mt-3 text-xs text-subtle">Illustration de l'interface prévue. Aucun appareil réel n'est connecté.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
