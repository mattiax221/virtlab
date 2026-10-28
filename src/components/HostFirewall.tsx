"use client";

import { defaultHostFirewall } from "@/lib/network/hostFirewall";
import type {
  Device,
  HostFirewall,
  HostFirewallRule,
  LabState,
} from "@/lib/network/types";

function uid() {
  return `r${Math.random().toString(36).slice(2, 9)}`;
}

export function HostFirewallPanel({
  device,
  stateRef,
  setState,
  onClose,
}: {
  device: Device;
  stateRef: React.MutableRefObject<LabState>;
  setState: (next: LabState) => void;
  onClose: () => void;
}) {
  const live =
    stateRef.current.devices.find((d) => d.id === device.id) ?? device;
  const fw: HostFirewall = live.hostFirewall ?? defaultHostFirewall();

  function patch(next: HostFirewall) {
    const state: LabState = {
      ...stateRef.current,
      devices: stateRef.current.devices.map((d) =>
        d.id === device.id ? { ...d, hostFirewall: next } : d,
      ),
    };
    stateRef.current = state;
    setState(state);
  }

  function updateRule(id: string, partial: Partial<HostFirewallRule>) {
    patch({
      ...fw,
      rules: fw.rules.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    });
  }

  function addRule() {
    const rule: HostFirewallRule = {
      id: uid(),
      enabled: true,
      action: "deny",
      direction: "in",
      proto: "icmp",
      description: "Nuova regola",
    };
    patch({ ...fw, rules: [...fw.rules, rule] });
  }

  function removeRule(id: string) {
    patch({ ...fw, rules: fw.rules.filter((r) => r.id !== id) });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-3 py-1.5 text-xs text-white">
        <span>Firewall — {live.name}</span>
        <button
          type="button"
          className="px-2 hover:bg-rose-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={fw.enabled}
            onChange={(e) => patch({ ...fw, enabled: e.target.checked })}
          />
          Firewall attivo
        </label>
        <label className="flex items-center gap-2 text-[#333]">
          <input
            type="checkbox"
            checked={fw.defaultDeny}
            onChange={(e) => patch({ ...fw, defaultDeny: e.target.checked })}
          />
          Default deny (blocca ciò che non matcha una regola allow)
        </label>
        <p className="text-[11px] leading-relaxed text-[#555]">
          Valutato su ICMP (ping) e TCP HTTP dal Desktop. Prima regola che
          matcha vince. IP remoto vuoto = any.
        </p>

        <div className="space-y-2">
          {fw.rules.map((r) => (
            <div
              key={r.id}
              className="rounded border border-[#aca899] bg-white p-2 shadow-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) =>
                      updateRule(r.id, { enabled: e.target.checked })
                    }
                  />
                  on
                </label>
                <select
                  className="rounded border border-[#aca899] px-1 py-0.5"
                  value={r.action}
                  onChange={(e) =>
                    updateRule(r.id, {
                      action: e.target.value as HostFirewallRule["action"],
                    })
                  }
                >
                  <option value="allow">allow</option>
                  <option value="deny">deny</option>
                </select>
                <select
                  className="rounded border border-[#aca899] px-1 py-0.5"
                  value={r.direction}
                  onChange={(e) =>
                    updateRule(r.id, {
                      direction: e.target.value as HostFirewallRule["direction"],
                    })
                  }
                >
                  <option value="in">in</option>
                  <option value="out">out</option>
                </select>
                <select
                  className="rounded border border-[#aca899] px-1 py-0.5"
                  value={r.proto}
                  onChange={(e) =>
                    updateRule(r.id, {
                      proto: e.target.value as HostFirewallRule["proto"],
                    })
                  }
                >
                  <option value="any">any</option>
                  <option value="icmp">icmp</option>
                  <option value="tcp">tcp</option>
                  <option value="udp">udp</option>
                </select>
                <button
                  type="button"
                  className="ml-auto text-rose-700 hover:underline"
                  onClick={() => removeRule(r.id)}
                >
                  elimina
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1">
                  porta
                  <input
                    className="w-16 rounded border border-[#aca899] px-1 py-0.5"
                    type="number"
                    placeholder="any"
                    value={r.port ?? ""}
                    onChange={(e) =>
                      updateRule(r.id, {
                        port: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-1">
                  remote IP
                  <input
                    className="w-28 rounded border border-[#aca899] px-1 py-0.5 font-mono"
                    placeholder="any"
                    value={r.remoteIp ?? ""}
                    onChange={(e) =>
                      updateRule(r.id, {
                        remoteIp: e.target.value.trim() || undefined,
                      })
                    }
                  />
                </label>
                <input
                  className="min-w-[8rem] flex-1 rounded border border-[#aca899] px-1 py-0.5"
                  placeholder="descrizione"
                  value={r.description ?? ""}
                  onChange={(e) =>
                    updateRule(r.id, { description: e.target.value })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="rounded border border-[#aca899] bg-[#ece9d8] px-3 py-1.5 hover:bg-white"
          onClick={addRule}
        >
          + Aggiungi regola
        </button>
      </div>
    </div>
  );
}
