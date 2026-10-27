import type { DeviceType } from "@/lib/network/types";

export function DeviceIcon({
  type,
  className = "",
}: {
  type: DeviceType;
  className?: string;
}) {
  if (type === "pc") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <rect x="8" y="10" width="48" height="32" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
        <rect x="12" y="14" width="40" height="24" fill="#0ea5e9" opacity="0.35" />
        <rect x="22" y="44" width="20" height="3" fill="#64748b" />
        <rect x="16" y="47" width="32" height="4" rx="1" fill="#94a3b8" />
      </svg>
    );
  }
  if (type === "switch") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <rect x="6" y="20" width="52" height="24" rx="3" fill="#14532d" stroke="#4ade80" strokeWidth="2" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={12 + i * 7}
            y="28"
            width="5"
            height="8"
            rx="0.5"
            fill={i % 2 === 0 ? "#86efac" : "#22c55e"}
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="10" y="16" width="44" height="32" rx="4" fill="#7c2d12" stroke="#fb923c" strokeWidth="2" />
      <circle cx="22" cy="32" r="4" fill="#fdba74" />
      <circle cx="32" cy="32" r="4" fill="#fb923c" />
      <circle cx="42" cy="32" r="4" fill="#fdba74" />
      <rect x="18" y="44" width="28" height="3" fill="#9a3412" />
    </svg>
  );
}
