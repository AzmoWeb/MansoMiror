/**
 * Animated phone screen for the hero scene: a photo gallery app that is
 * visibly "alive" (Ken Burns photo, scrolling thumbnails, a tap, a like).
 * Rendered twice — on the phone and mirrored in the laptop window — with the
 * mirrored copy delayed by `lag` seconds to suggest real-time transmission.
 * Sizes are in em: the parent sets font-size. All motion stops under
 * prefers-reduced-motion (see .mm-anim in globals.css).
 */
const thumbs = [
  "linear-gradient(160deg,#FFB86B,#F2552F)",
  "linear-gradient(160deg,#9CB1FF,#2448D8)",
  "linear-gradient(160deg,#C9F0D8,#3E9B6B)",
  "linear-gradient(160deg,#FFE29A,#F5B92E)",
  "linear-gradient(160deg,#E2C7FF,#7B4BD9)",
  "linear-gradient(160deg,#BFE6FF,#3A8DDE)",
];

export function LivePhoneScreen({ lag = 0 }: { lag?: number }) {
  const d = (s: number) => ({ animationDelay: `${s + lag}s` });
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0B0D14] text-white" aria-hidden="true">
      {/* status bar */}
      <div className="flex items-center justify-between px-[1.1em] pt-[0.9em] text-[0.62em] font-semibold">
        <span>10:24</span>
        <span className="flex items-center gap-[0.35em]">
          <span className="inline-block h-[0.55em] w-[0.9em] rounded-[0.12em] border border-white/80">
            <span className="block h-full w-[70%] bg-white/90" />
          </span>
        </span>
      </div>

      {/* header */}
      <div className="flex items-center justify-between px-[1.1em] pt-[1.1em]">
        <span className="font-display text-[1.25em] font-bold tracking-tight">Galerie</span>
        <span className="size-[1.6em] rounded-full bg-[linear-gradient(135deg,#9CB1FF,#2448D8)]" />
      </div>

      {/* hero photo: a drawn landscape, slowly panned */}
      <div className="relative mx-[0.9em] mt-[0.9em] overflow-hidden rounded-[1em]" style={{ aspectRatio: "4 / 4.6" }}>
        <div className="mm-anim mm-kenburns absolute inset-0 origin-center" style={d(0)}>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#2B3F9E_0%,#7A6BD6_38%,#FFA36C_68%,#FFD39A_80%)]" />
          <div className="absolute left-[62%] top-[46%] size-[18%] -translate-x-1/2 rounded-full bg-[#FFE8B5] blur-[0.08em]" />
          <div className="absolute inset-x-0 bottom-0 h-[52%] bg-[#3B2E6E] [clip-path:polygon(0_60%,18%_25%,33%_48%,52%_8%,70%_42%,84%_22%,100%_50%,100%_100%,0_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[#1C1640] [clip-path:polygon(0_45%,22%_15%,41%_52%,63%_20%,82%_55%,100%_30%,100%_100%,0_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[14%] bg-[linear-gradient(180deg,#5E79E8,#1C338C)] opacity-80" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.55),transparent)] px-[0.8em] pb-[0.7em] pt-[1.6em]">
          <p className="text-[0.82em] font-semibold">Lac d'Annecy</p>
          <p className="text-[0.6em] text-white/75">Aujourd'hui · 18:42</p>
        </div>
        {/* like pop */}
        <svg className="mm-anim mm-heart absolute left-1/2 top-[40%] w-[26%] -translate-x-1/2 -translate-y-1/2" style={d(0)} viewBox="0 0 24 24">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.5 1.1 4.3 2.5h2.6C14.1 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21Z" fill="#fff" />
        </svg>
        {/* tap ripple */}
        <span className="mm-anim mm-tap absolute left-1/2 top-[40%] size-[2.6em] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.15em] border-white/90 bg-white/25" style={d(0)} />
      </div>

      {/* scrolling thumbnails */}
      <p className="px-[1.1em] pt-[0.9em] text-[0.68em] font-semibold text-white/80">Souvenirs</p>
      <div className="mt-[0.5em] overflow-hidden">
        <div className="mm-anim mm-marquee flex w-max gap-[0.5em] pl-[0.9em]" style={d(0)}>
          {[...thumbs, ...thumbs].map((g, i) => (
            <span key={i} className="block size-[3.2em] shrink-0 rounded-[0.6em]" style={{ background: g }} />
          ))}
        </div>
      </div>

      {/* bottom nav */}
      <div className="mt-auto flex items-center justify-around border-t border-white/10 px-[1em] pb-[1.2em] pt-[0.7em]">
        <span className="size-[1.1em] rounded-[0.3em] bg-[#7B98FF]" />
        <span className="size-[1.1em] rounded-full border-[0.14em] border-white/45" />
        <span className="size-[1.1em] rounded-[0.3em] border-[0.14em] border-white/45" />
        <span className="size-[1.1em] rounded-full border-[0.14em] border-white/45" />
      </div>
      <span className="absolute bottom-[0.45em] left-1/2 h-[0.22em] w-[34%] -translate-x-1/2 rounded-full bg-white/70" />
    </div>
  );
}
