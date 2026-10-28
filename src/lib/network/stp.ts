import { isManagedSwitch, type LabState, type Link } from "./types";

/**
 * STP semplificato: tra due switch collegati da più link (loop),
 * lascia un solo path forwarding (root = switch con id lessicografico minore).
 */
export function recomputeStp(state: LabState): LabState {
  const switches = state.devices.filter((d) => isManagedSwitch(d.type));
  if (switches.length === 0) return clearStp(state);

  const root = [...switches].sort((a, b) => a.id.localeCompare(b.id))[0]!;

  // Reset all switch ports to forwarding/designated
  let devices = state.devices.map((d) => {
    if (!isManagedSwitch(d.type)) return d;
    return {
      ...d,
      interfaces: d.interfaces.map((i) => ({
        ...i,
        stpState: "forwarding" as "forwarding" | "blocking",
        stpRole: "designated" as
          | "root"
          | "designated"
          | "alternate"
          | "disabled",
      })),
    };
  });

  // Find pairs of switches with multiple ethernet links → block extras
  const pairLinks = new Map<string, Link[]>();
  for (const link of state.links) {
    if (link.media === "console" || link.media === "serial") continue;
    const a = devices.find((d) => d.id === link.aDeviceId);
    const b = devices.find((d) => d.id === link.bDeviceId);
    if (!a || !b) continue;
    if (!isManagedSwitch(a.type) || !isManagedSwitch(b.type)) continue;
    const key = [a.id, b.id].sort().join("|");
    const list = pairLinks.get(key) ?? [];
    list.push(link);
    pairLinks.set(key, list);
  }

  for (const [, links] of pairLinks) {
    if (links.length < 2) continue;
    // Keep lowest link id forwarding; block the rest on the non-root side
    const sorted = [...links].sort((x, y) => x.id.localeCompare(y.id));
    for (const extra of sorted.slice(1)) {
      const aIsRoot = extra.aDeviceId === root.id;
      const blockDeviceId = aIsRoot ? extra.bDeviceId : extra.aDeviceId;
      const blockIfaceId = aIsRoot ? extra.bIfaceId : extra.aIfaceId;
      devices = devices.map((d) => {
        if (d.id !== blockDeviceId) return d;
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === blockIfaceId
              ? {
                  ...i,
                  stpState: "blocking" as const,
                  stpRole: "alternate" as const,
                }
              : i,
          ),
        };
      });
    }
  }

  // Mark root ports conceptually on non-root switches (first link toward root)
  devices = devices.map((d) => {
    if (!isManagedSwitch(d.type) || d.id === root.id) {
      if (d.id === root.id) {
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.stpState === "blocking"
              ? i
              : { ...i, stpRole: "designated" as const },
          ),
        };
      }
      return d;
    }
    return d;
  });

  return { ...state, devices };
}

function clearStp(state: LabState): LabState {
  return {
    ...state,
    devices: state.devices.map((d) => ({
      ...d,
      interfaces: d.interfaces.map((i) => ({
        ...i,
        stpState: undefined,
        stpRole: undefined,
      })),
    })),
  };
}
