"use client";

import { useEffect, useState } from "react";
import type { SimPacket } from "@/lib/network/simulation";

export function SimOverlay({
  packets,
  onDone,
}: {
  packets: SimPacket[];
  onDone: () => void;
}) {
  const [packetIdx, setPacketIdx] = useState(0);
  const [t, setT] = useState(0); // 0..1 along current hop segment
  const [hop, setHop] = useState(0);

  const packet = packets[packetIdx];

  useEffect(() => {
    if (!packet || packet.hops.length < 2) {
      const id = window.setTimeout(onDone, 800);
      return () => window.clearTimeout(id);
    }
    let raf = 0;
    let start = performance.now();
    const hopDuration = 700;
    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / hopDuration);
      setT(u);
      if (u >= 1) {
        if (hop < packet.hops.length - 2) {
          setHop((h) => h + 1);
          start = now;
          setT(0);
          raf = requestAnimationFrame(tick);
        } else if (packetIdx < packets.length - 1) {
          setPacketIdx((i) => i + 1);
          setHop(0);
          setT(0);
          start = now;
          raf = requestAnimationFrame(tick);
        } else {
          window.setTimeout(onDone, 600);
        }
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // restart when packet/hop changes via state in loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packetIdx, hop, packet?.id]);

  if (!packet || packet.hops.length === 0) return null;

  const a = packet.hops[Math.min(hop, packet.hops.length - 1)];
  const b = packet.hops[Math.min(hop + 1, packet.hops.length - 1)];
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const color =
    packet.kind === "ARP"
      ? "#fbbf24"
      : packet.kind === "DHCP"
        ? "#38bdf8"
        : packet.kind === "DNS"
          ? "#a78bfa"
          : packet.kind === "HTTP"
            ? "#fb923c"
            : packet.kind === "PRINT"
              ? "#e879f9"
              : packet.ok
                ? "#34d399"
                : "#f87171";

  const atPrinter =
    packet.kind === "PRINT" &&
    packet.label.startsWith("LPR") &&
    t > 0.85 &&
    hop >= packet.hops.length - 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* traccia del percorso */}
      {packet.hops.length >= 2 && (
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <polyline
            fill="none"
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth={2}
            strokeDasharray="6 4"
            points={packet.hops.map((h) => `${h.x},${h.y}`).join(" ")}
          />
        </svg>
      )}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-2.5 py-1 text-[10px] font-bold shadow-lg"
        style={{
          left: x,
          top: y,
          borderColor: color,
          background: "#0f172aee",
          color,
          boxShadow: `0 0 16px ${color}66`,
        }}
      >
        {packet.kind === "PRINT" ? "🖨 PRINT" : packet.kind}
      </div>
      {atPrinter && packet.toDeviceId && (
        <div
          className="absolute -translate-x-1/2 animate-pulse rounded-md border-2 border-fuchsia-400 bg-fuchsia-950/90 px-2 py-1 text-[10px] font-semibold text-fuchsia-100"
          style={{
            left: packet.hops[packet.hops.length - 1]?.x,
            top: (packet.hops[packet.hops.length - 1]?.y ?? 0) + 28,
          }}
        >
          Stampa in corso…
        </div>
      )}
      <div className="absolute left-1/2 top-3 max-w-lg -translate-x-1/2 rounded-full border border-slate-600 bg-slate-950/90 px-4 py-1.5 text-center text-xs text-slate-200">
        Simulation: {packet.label} — {packet.detail}
      </div>
    </div>
  );
}
