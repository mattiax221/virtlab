import type { DeviceKind } from "@/lib/network/types";

export function DeviceIcon({
  type,
  className = "",
}: {
  type: DeviceKind;
  className?: string;
}) {
  const common = className;
  switch (type) {
    case "pc":
    case "laptop":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="8" y={type === "laptop" ? 18 : 10} width="48" height={type === "laptop" ? 28 : 32} rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <rect x="12" y={type === "laptop" ? 22 : 14} width="40" height={type === "laptop" ? 20 : 24} fill="#0ea5e9" opacity="0.35" />
          {type === "laptop" ? (
            <path d="M6 48h52l-4-4H10z" fill="#94a3b8" />
          ) : (
            <>
              <rect x="22" y="44" width="20" height="3" fill="#64748b" />
              <rect x="16" y="47" width="32" height="4" rx="1" fill="#94a3b8" />
            </>
          )}
        </svg>
      );
    case "server":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="14" y="8" width="36" height="48" rx="3" fill="#1e3a5f" stroke="#7dd3fc" strokeWidth="2" />
          <rect x="18" y="14" width="28" height="8" rx="1" fill="#0ea5e9" opacity="0.5" />
          <rect x="18" y="28" width="28" height="8" rx="1" fill="#0ea5e9" opacity="0.35" />
          <rect x="18" y="42" width="28" height="8" rx="1" fill="#0ea5e9" opacity="0.25" />
          <circle cx="22" cy="18" r="1.5" fill="#4ade80" />
          <circle cx="22" cy="32" r="1.5" fill="#4ade80" />
        </svg>
      );
    case "printer":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="18" y="8" width="28" height="14" rx="1" fill="#cbd5e1" />
          <rect x="10" y="22" width="44" height="22" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
          <rect x="18" y="40" width="28" height="14" rx="1" fill="#e2e8f0" />
          <circle cx="48" cy="30" r="2" fill="#4ade80" />
        </svg>
      );
    case "ip_phone":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="20" y="10" width="24" height="44" rx="4" fill="#0f172a" stroke="#a78bfa" strokeWidth="2" />
          <rect x="24" y="16" width="16" height="10" fill="#c4b5fd" opacity="0.5" />
          <circle cx="32" cy="40" r="6" fill="#312e81" stroke="#a78bfa" />
        </svg>
      );
    case "hub":
    case "switch":
    case "multilayer_switch":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect
            x="6"
            y="20"
            width="52"
            height="24"
            rx="3"
            fill={type === "hub" ? "#3f3f46" : type === "multilayer_switch" ? "#1e3a8a" : "#14532d"}
            stroke={type === "hub" ? "#a1a1aa" : type === "multilayer_switch" ? "#93c5fd" : "#4ade80"}
            strokeWidth="2"
          />
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
    case "router":
    case "wireless_router":
    case "firewall":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect
            x="10"
            y="18"
            width="44"
            height="28"
            rx="4"
            fill={type === "firewall" ? "#450a0a" : "#7c2d12"}
            stroke={type === "firewall" ? "#f87171" : "#fb923c"}
            strokeWidth="2"
          />
          <circle cx="22" cy="32" r="4" fill="#fdba74" />
          <circle cx="32" cy="32" r="4" fill="#fb923c" />
          <circle cx="42" cy="32" r="4" fill="#fdba74" />
          {type === "wireless_router" && (
            <>
              <path d="M20 16c6-6 18-6 24 0" fill="none" stroke="#7dd3fc" strokeWidth="2" />
              <path d="M24 12c4-4 12-4 16 0" fill="none" stroke="#7dd3fc" strokeWidth="1.5" />
            </>
          )}
        </svg>
      );
    case "access_point":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <circle cx="32" cy="36" r="10" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="2" />
          <path d="M18 28c8-10 20-10 28 0" fill="none" stroke="#7dd3fc" strokeWidth="2" />
          <path d="M22 22c6-8 14-8 20 0" fill="none" stroke="#7dd3fc" strokeWidth="1.5" />
        </svg>
      );
    case "modem_dsl":
    case "modem_cable":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="8" y="22" width="48" height="20" rx="3" fill="#422006" stroke="#fbbf24" strokeWidth="2" />
          <rect x="14" y="28" width="8" height="8" fill="#fde68a" />
          <rect x="28" y="28" width="8" height="8" fill="#fbbf24" />
          <rect x="42" y="28" width="8" height="8" fill="#f59e0b" />
          <text x="32" y="18" textAnchor="middle" fontSize="8" fill="#fcd34d">
            {type === "modem_dsl" ? "DSL" : "CABLE"}
          </text>
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <ellipse cx="28" cy="34" rx="16" ry="12" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
          <ellipse cx="40" cy="30" rx="14" ry="11" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
          <ellipse cx="32" cy="36" rx="18" ry="10" fill="#64748b" opacity="0.9" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="12" y="12" width="40" height="40" rx="4" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
        </svg>
      );
  }
}
