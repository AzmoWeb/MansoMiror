"use client";

import { forwardRef, useEffect, useRef, type Ref } from "react";

/**
 * Phone screen playing a real video (our own clip: public/media/phone-clip.*,
 * source in brand/source/). Used twice in the hero: on the phone, and mirrored
 * in the MansoMirror window. Sizes are in em: the parent sets font-size.
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const CLIP = {
  mp4: `${base}/media/phone-clip.mp4`,
  webm: `${base}/media/phone-clip.webm`,
  poster: `${base}/media/phone-clip-poster.jpg`,
};

export const VideoScreen = forwardRef(function VideoScreen(
  { autoPlay }: { autoPlay: boolean },
  ref: Ref<HTMLVideoElement>,
) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const bar = useRef<HTMLSpanElement>(null);

  // Progress bar driven by the real playback position.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = localRef.current;
      if (v && bar.current && v.duration) bar.current.style.width = `${(v.currentTime / v.duration) * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white" aria-hidden="true">
      <video
        ref={(el) => {
          localRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) (ref as { current: HTMLVideoElement | null }).current = el;
        }}
        className="absolute inset-0 h-full w-full object-cover"
        poster={CLIP.poster}
        muted
        loop
        playsInline
        autoPlay={autoPlay}
        preload="auto"
        tabIndex={-1}
      >
        <source src={CLIP.webm} type="video/webm" />
        <source src={CLIP.mp4} type="video/mp4" />
      </video>

      {/* player chrome */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-[linear-gradient(180deg,rgba(0,0,0,.45),transparent)] px-[1.1em] pb-[1.4em] pt-[0.9em] text-[0.62em] font-semibold">
        <span>10:24</span>
        <span className="inline-block h-[0.55em] w-[0.9em] rounded-[0.12em] border border-white/80">
          <span className="block h-full w-[70%] bg-white/90" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.6),transparent)] px-[1em] pb-[1.6em] pt-[2.4em]">
        <p className="text-[0.85em] font-semibold">Coucher de soleil</p>
        <p className="text-[0.6em] text-white/70">Vidéo · en lecture</p>
        <div className="mt-[0.7em] h-[0.22em] overflow-hidden rounded-full bg-white/25">
          <span ref={bar} className="block h-full w-0 rounded-full bg-white" />
        </div>
        <div className="mt-[0.7em] flex items-center justify-center gap-[1.6em]">
          <svg viewBox="0 0 24 24" className="w-[1.1em]" fill="white" opacity=".8"><path d="M6 6h2v12H6zM9.5 12 18 6v12z" /></svg>
          <svg viewBox="0 0 24 24" className="w-[1.6em]" fill="white"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          <svg viewBox="0 0 24 24" className="w-[1.1em]" fill="white" opacity=".8"><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z" /></svg>
        </div>
      </div>
      <span className="absolute bottom-[0.45em] left-1/2 h-[0.22em] w-[34%] -translate-x-1/2 rounded-full bg-white/70" />
    </div>
  );
});
