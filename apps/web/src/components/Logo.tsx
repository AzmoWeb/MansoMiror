export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--mm-accent)" />
      <line x1="32" y1="11" x2="32" y2="53" stroke="var(--mm-on-accent)" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 46V19l15 16" fill="none" stroke="var(--mm-on-accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47 46V19L32 35" fill="none" stroke="var(--mm-on-accent)" strokeOpacity="0.62" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[1.0625rem] font-bold tracking-tight">
        Manso<span className="text-accent-ink">Mirror</span>
      </span>
    </span>
  );
}
