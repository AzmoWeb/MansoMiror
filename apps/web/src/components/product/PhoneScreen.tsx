/**
 * Illustrated phone home screen used inside product illustrations.
 * Purely decorative: it is a drawing, never a live capture.
 */
const tiles = [
  "var(--mm-accent)",
  "#F5B92E",
  "#6E6E68",
  "#F2552F",
  "#2CBFA2",
  "#3F3F3B",
  "#9FEAD6",
  "#BDBDB8",
  "#0D453D",
  "#FF9B85",
  "#55554F",
  "#62D7BD",
];

export function PhoneScreen({ blur = 0 }: { blur?: number }) {
  return (
    <div
      className="flex h-full w-full flex-col bg-[linear-gradient(170deg,#0C544A_0%,#032823_100%)] p-[9%] text-white"
      style={{ filter: blur ? `blur(${blur}px)` : undefined }}
      aria-hidden="true"
    >
      <div className="flex justify-between font-mono text-[0.5em] opacity-80">
        <span>10:24</span>
        <span>●●● 87%</span>
      </div>
      <div className="mt-[18%] font-display text-[1.6em] font-bold leading-none tracking-tight">10:24</div>
      <div className="mt-[4%] text-[0.55em] opacity-75">mardi 9 novembre</div>
      <div className="mt-auto grid grid-cols-4 gap-[9%]">
        {tiles.map((c, i) => (
          <span key={i} className="aspect-square rounded-[22%]" style={{ background: c }} />
        ))}
      </div>
      <div className="mx-auto mt-[12%] h-[3px] w-1/3 rounded-full bg-white/60" />
    </div>
  );
}
