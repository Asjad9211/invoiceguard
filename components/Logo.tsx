export function LogoMark({ size = 28 }: { size?: number }) {
  // A ledger sheet with a folded corner and a verification tick — "the bill, checked".
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#0B1220" />
      <path d="M9 7h10l5 5v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="#fff" />
      <path d="M19 7v4a1 1 0 0 0 1 1h4z" fill="#C9D3FF" />
      <path d="M11 13h5M11 16h9" stroke="#0B1220" strokeWidth="1.4" strokeLinecap="round" opacity=".35" />
      <path d="M11.5 20.5l2.6 2.6 5.4-5.6" stroke="#2F5BFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`font-display text-[17px] font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        Invoice<span className="text-cobalt">Guard</span>
      </span>
    </span>
  );
}
