import { iconFamily, type DeviceKind } from "@/lib/network/types";

/** Icone stile Packet Tracer (disco router / box switch / end devices). */
export function DeviceIcon({
  type,
  className = "",
}: {
  type: DeviceKind;
  className?: string;
}) {
  const family = iconFamily(type);
  const common = className;

  switch (family) {
    case "pc":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          {/* Desktop monitor + base — ben distinto dal server tower */}
          <rect x="8" y="6" width="48" height="36" rx="3" fill="#334155" />
          <rect x="12" y="10" width="40" height="28" rx="1" fill="#7dd3fc" />
          <rect x="14" y="12" width="36" height="24" fill="#0f172a" />
          <rect x="28" y="42" width="8" height="5" fill="#475569" />
          <rect x="16" y="47" width="32" height="7" rx="1" fill="#94a3b8" />
          <rect x="22" y="49" width="8" height="2" rx="0.5" fill="#64748b" />
        </svg>
      );
    case "laptop":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="12" y="12" width="40" height="26" rx="2" fill="#334155" />
          <rect x="16" y="16" width="32" height="18" fill="#0f172a" />
          <path d="M6 42h52l-5-4H11z" fill="#94a3b8" />
          <rect x="26" y="44" width="12" height="2" rx="1" fill="#64748b" />
        </svg>
      );
    case "server":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          {/* Tower rack 2U-style — non confondibile col PC */}
          <rect x="16" y="4" width="32" height="56" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
          <rect x="20" y="10" width="24" height="10" rx="1" fill="#0f172a" />
          <rect x="20" y="24" width="24" height="10" rx="1" fill="#0f172a" />
          <rect x="20" y="38" width="24" height="10" rx="1" fill="#0f172a" />
          <circle cx="24" cy="15" r="1.8" fill="#4ade80" />
          <circle cx="24" cy="29" r="1.8" fill="#4ade80" />
          <circle cx="24" cy="43" r="1.8" fill="#fbbf24" />
          <rect x="30" y="13" width="10" height="2" rx="0.5" fill="#475569" />
          <rect x="30" y="27" width="10" height="2" rx="0.5" fill="#475569" />
          <rect x="30" y="41" width="10" height="2" rx="0.5" fill="#475569" />
          <text x="32" y="56" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="sans-serif">
            SRV
          </text>
          {type === "meraki_server" && (
            <circle cx="44" cy="52" r="5" fill="#22c55e" />
          )}
          {type === "cyber_observer" && (
            <circle cx="32" cy="52" r="5" fill="#0f172a" stroke="#4ade80" strokeWidth="1.5" />
          )}
        </svg>
      );
    case "printer":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="18" y="8" width="28" height="12" rx="1" fill="#94a3b8" />
          <rect x="10" y="20" width="44" height="22" rx="3" fill="#64748b" />
          <rect x="18" y="38" width="28" height="14" rx="1" fill="#e2e8f0" />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="20" y="8" width="24" height="48" rx="4" fill="#64748b" />
          <rect x="24" y="14" width="16" height="12" fill="#94a3b8" />
          {type === "ip_phone" && (
            <circle cx="44" cy="48" r="7" fill="#0ea5e9" />
          )}
          {type === "ip_phone" && (
            <text x="44" y="51" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">
              IP
            </text>
          )}
        </svg>
      );
    case "tv":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="8" y="12" width="48" height="34" rx="2" fill="#64748b" />
          <rect x="12" y="16" width="40" height="26" fill="#334155" />
          <rect x="26" y="48" width="12" height="4" fill="#94a3b8" />
        </svg>
      );
    case "sniffer":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <path d="M12 40 L32 12 L52 40 Z" fill="#64748b" stroke="#94a3b8" strokeWidth="2" />
          <circle cx="32" cy="32" r="6" fill="#38bdf8" opacity="0.6" />
        </svg>
      );
    case "hub":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="8" y="22" width="48" height="22" rx="2" fill="#38bdf8" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={14 + i * 6} y="28" width="3" height="10" fill="#0c4a6e" opacity="0.5" />
          ))}
        </svg>
      );
    case "bridge":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <path
            d="M8 40 Q32 8 56 40"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <rect x="6" y="38" width="12" height="10" rx="1" fill="#0ea5e9" />
          <rect x="46" y="38" width="12" height="10" rx="1" fill="#0ea5e9" />
        </svg>
      );
    case "switch":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="8" y="18" width="48" height="28" rx="3" fill="#38bdf8" />
          {/* frecce PT-style */}
          <path d="M20 28 L28 28 L28 24 L36 32 L28 40 L28 36 L20 36 Z" fill="#fff" opacity="0.9" />
          <path d="M44 36 L36 36 L36 40 L28 32 L36 24 L36 28 L44 28 Z" fill="#fff" opacity="0.9" />
        </svg>
      );
    case "router":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          {/* cilindro PT */}
          <ellipse cx="32" cy="44" rx="22" ry="8" fill="#0e7490" />
          <rect x="10" y="20" width="44" height="24" fill="#22d3ee" />
          <ellipse cx="32" cy="20" rx="22" ry="8" fill="#67e8f9" />
          {/* croce frecce */}
          <path d="M32 10 L32 30 M22 20 L42 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 10 L28 16 M32 10 L36 16 M22 20 L26 16 M22 20 L26 24 M42 20 L38 16 M42 20 L38 24 M32 30 L28 24 M32 30 L36 24" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "wifi":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <ellipse cx="32" cy="44" rx="20" ry="7" fill="#0e7490" />
          <rect x="12" y="24" width="40" height="20" fill="#22d3ee" />
          <ellipse cx="32" cy="24" rx="20" ry="7" fill="#67e8f9" />
          <path d="M32 14 L32 28 M24 21 L40 21" stroke="#fff" strokeWidth="2.5" />
          <rect x="18" y="8" width="3" height="10" rx="1" fill="#94a3b8" />
          <rect x="43" y="8" width="3" height="10" rx="1" fill="#94a3b8" />
        </svg>
      );
    case "firewall":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="10" y="14" width="44" height="36" rx="3" fill="#38bdf8" />
          <rect x="10" y="36" width="44" height="14" fill="#7f1d1d" />
          <circle cx="32" cy="28" r="8" fill="#fff" opacity="0.85" />
          <path d="M28 28 L36 28 M32 24 L32 32" stroke="#0c4a6e" strokeWidth="2" />
        </svg>
      );
    case "ap":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="12" y="22" width="40" height="24" rx="3" fill="#22d3ee" />
          <path
            d="M20 34 Q32 26 44 34"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {(type === "meraki_ap" || type === "wireless_router") && (
            <>
              <rect x="20" y="10" width="3" height="12" fill="#94a3b8" />
              <rect x="41" y="10" width="3" height="12" fill="#94a3b8" />
            </>
          )}
        </svg>
      );
    case "modem":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <rect x="8" y="22" width="48" height="22" rx="3" fill="#cbd5e1" />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx={16 + i * 8} cy="33" r="3" fill="#38bdf8" />
          ))}
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <ellipse cx="26" cy="34" rx="16" ry="12" fill="#38bdf8" />
          <ellipse cx="40" cy="30" rx="14" ry="11" fill="#22d3ee" />
          <ellipse cx="32" cy="38" rx="18" ry="10" fill="#67e8f9" />
        </svg>
      );
    case "tower":
      return (
        <svg viewBox="0 0 64 64" className={common} aria-hidden>
          <path d="M28 56 L32 12 L36 56 Z" fill="#64748b" />
          <path d="M32 18 L20 28 M32 18 L44 28 M32 28 L18 40 M32 28 L46 40" stroke="#94a3b8" strokeWidth="2" />
          <path d="M38 14 Q48 18 50 28" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <path d="M40 16 Q52 22 52 34" fill="none" stroke="#67e8f9" strokeWidth="2" />
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
