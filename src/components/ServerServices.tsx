"use client";

/**
 * Pannello Server-PT ricostruito dalle docs ufficiali:
 * https://tutorials.ptnetacad.net/help/default/config_servers.htm
 *
 * Tab: Config (GLOBAL + INTERFACE) | Services (HTTP DHCP TFTP DNS SYSLOG AAA NTP EMAIL FTP)
 */
import { useMemo, useState } from "react";
import { normalizeDhcp } from "@/lib/network/services";
import type {
  AaaClient,
  Device,
  DeviceServices,
  DhcpPool,
  DnsRecord,
  FtpAccount,
  LabState,
  ServerUser,
} from "@/lib/network/types";

type TopTab = "config" | "services";
type ConfigNav = "settings" | "algorithm" | string; // string = iface id
type SvcNav =
  | "http"
  | "dhcp"
  | "tftp"
  | "dns"
  | "syslog"
  | "aaa"
  | "ntp"
  | "email"
  | "ftp";

const SVC_ITEMS: { id: SvcNav; label: string }[] = [
  { id: "http", label: "HTTP" },
  { id: "dhcp", label: "DHCP" },
  { id: "tftp", label: "TFTP" },
  { id: "dns", label: "DNS" },
  { id: "syslog", label: "SYSLOG" },
  { id: "aaa", label: "AAA" },
  { id: "ntp", label: "NTP" },
  { id: "email", label: "EMAIL" },
  { id: "ftp", label: "FTP" },
];

export function ServerServices({
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
  const svc = live.services;

  const [top, setTop] = useState<TopTab>("services");
  const [configNav, setConfigNav] = useState<ConfigNav>("settings");
  const [svcNav, setSvcNav] = useState<SvcNav>("http");

  const [dnsDraft, setDnsDraft] = useState({
    name: "",
    type: "A" as DnsRecord["type"],
    ip: "",
    target: "",
  });
  const [poolDraft, setPoolDraft] = useState({
    name: "",
    gateway: "192.168.1.1",
    dns: "192.168.1.100",
    startIp: "192.168.1.150",
    mask: "255.255.255.0",
    maxUsers: 50,
  });
  const [emailUser, setEmailUser] = useState({ username: "", password: "" });
  const [ftpDraft, setFtpDraft] = useState({
    username: "",
    password: "cisco",
    write: true,
    read: true,
    delete: false,
    rename: false,
    list: true,
  });
  const [aaaClient, setAaaClient] = useState({
    name: "",
    ip: "",
    secret: "cisco",
    type: "radius" as AaaClient["type"],
  });
  const [aaaUser, setAaaUser] = useState({ username: "", password: "" });
  const [httpPage, setHttpPage] = useState("index.html");

  const ifaces = useMemo(
    () => live.interfaces.filter((i) => !i.parentIfaceId),
    [live.interfaces],
  );

  function commit(nextDev: Device) {
    const next = {
      ...stateRef.current,
      devices: stateRef.current.devices.map((d) =>
        d.id === live.id ? nextDev : d,
      ),
    };
    stateRef.current = next;
    setState(next);
  }

  function patchServices(patch: Partial<DeviceServices>) {
    commit({
      ...live,
      services: { ...live.services, ...patch },
      name: patch.displayName ?? live.name,
    });
  }

  function patchSvc(full: DeviceServices) {
    commit({ ...live, services: full, name: full.displayName ?? live.name });
  }

  function patchIface(
    ifaceId: string,
    fields: Partial<{
      ip: string | null;
      mask: string | null;
      gateway: string | null;
      enabled: boolean;
      dhcpClient: boolean;
      dnsServers: string[];
    }>,
  ) {
    commit({
      ...live,
      interfaces: live.interfaces.map((i) =>
        i.id === ifaceId ? { ...i, ...fields } : i,
      ),
    });
  }

  if (!svc) {
    return (
      <div className="p-4 text-sm">
        Nessun servizio.{" "}
        <button type="button" className="underline" onClick={onClose}>
          Chiudi
        </button>
      </div>
    );
  }

  const dhcp = normalizeDhcp(svc.dhcp) ?? {
    enabled: false,
    pools: [],
  };
  const httpPages = svc.http?.pages ?? [];
  const activePage =
    httpPages.find((p) => p.name === httpPage) ?? httpPages[0];

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#ece9d8] text-[12px] text-black"
      style={{ fontFamily: "Tahoma, Segoe UI, sans-serif" }}
    >
      {/* Title bar PT-like */}
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">
          {svc.displayName ?? live.name} — Server-PT
        </span>
        <button
          type="button"
          className="px-2 hover:bg-rose-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Top tabs: Config | Services */}
      <div className="flex gap-0 border-b border-[#aca899] bg-[#ece9d8] px-1 pt-1">
        {(
          [
            ["config", "Config"],
            ["services", "Services"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTop(id)}
            className={`rounded-t px-4 py-1 ${
              top === id
                ? "border border-b-0 border-[#aca899] bg-white font-semibold"
                : "text-[#555]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left navigation */}
        <div className="w-44 shrink-0 overflow-y-auto border-r border-[#aca899] bg-[#f0f0f0] p-1">
          {top === "config" ? (
            <>
              <NavGroup label="GLOBAL">
                <NavItem
                  active={configNav === "settings"}
                  onClick={() => setConfigNav("settings")}
                >
                  Settings
                </NavItem>
                <NavItem
                  active={configNav === "algorithm"}
                  onClick={() => setConfigNav("algorithm")}
                >
                  Algorithm Settings
                </NavItem>
              </NavGroup>
              <NavGroup label="INTERFACE">
                {ifaces.map((i) => (
                  <NavItem
                    key={i.id}
                    active={configNav === i.id}
                    onClick={() => setConfigNav(i.id)}
                  >
                    {i.name}
                  </NavItem>
                ))}
              </NavGroup>
            </>
          ) : (
            <NavGroup label="SERVICES">
              {SVC_ITEMS.map((s) => (
                <NavItem
                  key={s.id}
                  active={svcNav === s.id}
                  onClick={() => setSvcNav(s.id)}
                >
                  {s.label}
                </NavItem>
              ))}
            </NavGroup>
          )}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-3">
          {top === "config" && configNav === "settings" && (
            <Section title="Global Settings">
              <Field label="Display Name">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px]"
                  value={svc.displayName ?? live.name}
                  onChange={(e) =>
                    patchServices({ displayName: e.target.value })
                  }
                />
              </Field>
              <div className="mt-2 font-semibold">Gateway / DNS (IPv4)</div>
              <div className="mt-1 flex gap-3">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={(svc.ipv4Mode ?? "static") === "static"}
                    onChange={() => patchServices({ ipv4Mode: "static" })}
                  />
                  Static
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={svc.ipv4Mode === "dhcp"}
                    onChange={() => patchServices({ ipv4Mode: "dhcp" })}
                  />
                  DHCP
                </label>
              </div>
              <Field label="Gateway">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                  value={svc.gateway ?? ""}
                  disabled={svc.ipv4Mode === "dhcp"}
                  onChange={(e) => patchServices({ gateway: e.target.value })}
                />
              </Field>
              <Field label="DNS Server">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                  value={svc.dnsServer ?? ""}
                  disabled={svc.ipv4Mode === "dhcp"}
                  onChange={(e) =>
                    patchServices({ dnsServer: e.target.value })
                  }
                />
              </Field>
              <p className="mt-2 text-[11px] text-[#666]">
                Docs PT: Static imposta Gateway e DNS; DHCP ottiene la config
                automaticamente.
              </p>
            </Section>
          )}

          {top === "config" && configNav === "algorithm" && (
            <Section title="Algorithm Settings">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.algorithm?.useGlobal ?? true}
                  onChange={(e) =>
                    patchServices({
                      algorithm: {
                        useGlobal: e.target.checked,
                        maxConnections: svc.algorithm?.maxConnections ?? 100,
                        maxSessions: svc.algorithm?.maxSessions ?? 50,
                        retransmitMs: svc.algorithm?.retransmitMs ?? 2000,
                      },
                    })
                  }
                />
                Global Settings
              </label>
              {!(svc.algorithm?.useGlobal ?? true) && (
                <>
                  <Field label="Max Connections">
                    <input
                      type="number"
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                      value={svc.algorithm?.maxConnections ?? 100}
                      onChange={(e) =>
                        patchServices({
                          algorithm: {
                            ...svc.algorithm!,
                            useGlobal: false,
                            maxConnections: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Max Opened Sessions">
                    <input
                      type="number"
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                      value={svc.algorithm?.maxSessions ?? 50}
                      onChange={(e) =>
                        patchServices({
                          algorithm: {
                            ...svc.algorithm!,
                            useGlobal: false,
                            maxSessions: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Retransmit Timeout (ms)">
                    <input
                      type="number"
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                      value={svc.algorithm?.retransmitMs ?? 2000}
                      onChange={(e) =>
                        patchServices({
                          algorithm: {
                            ...svc.algorithm!,
                            useGlobal: false,
                            retransmitMs: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </Field>
                </>
              )}
            </Section>
          )}

          {top === "config" &&
            ifaces.some((i) => i.id === configNav) &&
            (() => {
              const i = ifaces.find((x) => x.id === configNav)!;
              return (
                <Section title={`Interface — ${i.name}`}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={i.enabled}
                      onChange={(e) =>
                        patchIface(i.id, { enabled: e.target.checked })
                      }
                    />
                    Port Status
                  </label>
                  <Field label="Bandwidth">
                    <select className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px]" defaultValue="auto" disabled>
                      <option>Auto</option>
                      <option>100 Mbps</option>
                      <option>1000 Mbps</option>
                    </select>
                  </Field>
                  <Field label="Duplex">
                    <select className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px]" defaultValue="auto" disabled>
                      <option>Auto</option>
                      <option>Full</option>
                    </select>
                  </Field>
                  <Field label="MAC Address">
                    <input
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                      value={i.mac}
                      readOnly
                    />
                  </Field>
                  <Field label="IP Address">
                    <input
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                      value={i.ip ?? ""}
                      onChange={(e) =>
                        patchIface(i.id, {
                          ip: e.target.value || null,
                          dhcpClient: false,
                        })
                      }
                    />
                  </Field>
                  <Field label="Subnet Mask">
                    <input
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                      value={i.mask ?? ""}
                      onChange={(e) =>
                        patchIface(i.id, { mask: e.target.value || null })
                      }
                    />
                  </Field>
                  <p className="mt-2 text-[11px] text-[#666]">
                    Media: {i.media} · Servers supportano tipicamente 2
                    interfacce (Ethernet / fiber / modem / wireless).
                  </p>
                </Section>
              );
            })()}

          {/* —— SERVICES —— */}
          {top === "services" && svcNav === "http" && svc.http && (
            <Section title="HTTP Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.http.enabled}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      http: { ...svc.http!, enabled: e.target.checked },
                    })
                  }
                />
                HTTP On
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.http.https ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      http: { ...svc.http!, https: e.target.checked },
                    })
                  }
                />
                HTTP Secure (HTTPS) On
              </label>
              <div className="mt-2 flex gap-2">
                <select
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px]"
                  value={activePage?.name ?? ""}
                  onChange={(e) => setHttpPage(e.target.value)}
                >
                  {httpPages.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  onClick={() => {
                    const name = window.prompt("Nome file HTML", "page.html");
                    if (!name) return;
                    patchSvc({
                      ...svc,
                      http: {
                        ...svc.http!,
                        pages: [
                          ...httpPages,
                          { name, body: `<html><body><h1>${name}</h1></body></html>` },
                        ],
                      },
                    });
                    setHttpPage(name);
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  disabled={!activePage || activePage.name === "index.html"}
                  onClick={() => {
                    if (!activePage) return;
                    patchSvc({
                      ...svc,
                      http: {
                        ...svc.http!,
                        pages: httpPages.filter((p) => p.name !== activePage.name),
                      },
                    });
                  }}
                >
                  Remove
                </button>
              </div>
              {activePage && (
                <textarea
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] mt-2 min-h-[180px] w-full font-mono text-[11px]"
                  value={activePage.body}
                  onChange={(e) => {
                    patchSvc({
                      ...svc,
                      http: {
                        ...svc.http!,
                        pages: httpPages.map((p) =>
                          p.name === activePage.name
                            ? { ...p, body: e.target.value }
                            : p,
                        ),
                      },
                    });
                  }}
                />
              )}
            </Section>
          )}

          {top === "services" && svcNav === "dhcp" && (
            <Section title="DHCP Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dhcp.enabled}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      dhcp: { ...dhcp, enabled: e.target.checked },
                    })
                  }
                />
                Service On
              </label>
              <div className="mt-2 grid gap-1 rounded border border-[#aca899] p-2">
                <div className="font-semibold">Add / edit pool</div>
                {(
                  [
                    ["name", "Pool Name"],
                    ["gateway", "Default Gateway"],
                    ["dns", "DNS Server"],
                    ["startIp", "Start IP Address"],
                    ["mask", "Subnet Mask"],
                  ] as const
                ).map(([k, lab]) => (
                  <Field key={k} label={lab}>
                    <input
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                      value={poolDraft[k]}
                      onChange={(e) =>
                        setPoolDraft({ ...poolDraft, [k]: e.target.value })
                      }
                    />
                  </Field>
                ))}
                <Field label="Max Users">
                  <input
                    type="number"
                    className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                    value={poolDraft.maxUsers}
                    onChange={(e) =>
                      setPoolDraft({
                        ...poolDraft,
                        maxUsers: Number(e.target.value) || 1,
                      })
                    }
                  />
                </Field>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                    onClick={() => {
                      if (!poolDraft.name.trim()) return;
                      if (poolDraft.name === "serverPool") {
                        window.alert(
                          "serverPool è riservato (docs PT: non modificabile come nuovo).",
                        );
                        return;
                      }
                      const pool: DhcpPool = {
                        name: poolDraft.name.trim(),
                        gateway: poolDraft.gateway,
                        dns: poolDraft.dns,
                        startIp: poolDraft.startIp,
                        mask: poolDraft.mask,
                        maxUsers: poolDraft.maxUsers,
                        leases: [],
                      };
                      patchSvc({
                        ...svc,
                        dhcp: {
                          enabled: dhcp.enabled,
                          pools: [...dhcp.pools, pool],
                        },
                      });
                      setPoolDraft({ ...poolDraft, name: "" });
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <div className="font-semibold">Pools</div>
                {dhcp.pools.map((p, idx) => (
                  <div
                    key={p.name + idx}
                    className="mt-1 flex items-start justify-between border border-[#ddd] p-1 font-mono text-[11px]"
                  >
                    <div>
                      <div className="font-semibold">
                        {p.name}
                        {p.locked ? " (default)" : ""}
                      </div>
                      <div>
                        {p.startIp}/{p.mask} gw {p.gateway} dns {p.dns} max{" "}
                        {p.maxUsers}
                      </div>
                      <div className="text-[#666]">
                        leases: {p.leases.length}
                      </div>
                    </div>
                    {!p.locked && (
                      <button
                        type="button"
                        className="text-rose-700"
                        onClick={() =>
                          patchSvc({
                            ...svc,
                            dhcp: {
                              enabled: dhcp.enabled,
                              pools: dhcp.pools.filter((_, i) => i !== idx),
                            },
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <p className="mt-1 text-[11px] text-[#666]">
                  Il pool predefinito serverPool non può essere rimosso (docs
                  PT).
                </p>
              </div>
            </Section>
          )}

          {top === "services" && svcNav === "tftp" && (
            <Section title="TFTP Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.tftp?.enabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      tftp: {
                        enabled: e.target.checked,
                        images: svc.tftp?.images ?? [],
                      },
                    })
                  }
                />
                Service On
              </label>
              <p className="mt-1 text-[11px] text-[#666]">
                Nessun parametro da impostare. Contiene immagini IOS per flash
                di router/switch.
              </p>
              <ul className="mt-2 space-y-1">
                {(svc.tftp?.images ?? []).map((img, idx) => (
                  <li
                    key={img.name}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>
                      {img.name} ({img.sizeKb} KB)
                    </span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          tftp: {
                            enabled: svc.tftp?.enabled ?? true,
                            images: (svc.tftp?.images ?? []).filter(
                              (_, i) => i !== idx,
                            ),
                          },
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {top === "services" && svcNav === "dns" && svc.dns && (
            <Section title="DNS Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.dns.enabled}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      dns: { ...svc.dns!, enabled: e.target.checked },
                    })
                  }
                />
                Service On
              </label>
              <div className="mt-2 flex flex-wrap gap-1">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-28 font-mono"
                  placeholder="Name"
                  value={dnsDraft.name}
                  onChange={(e) =>
                    setDnsDraft({ ...dnsDraft, name: e.target.value })
                  }
                />
                <select
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px]"
                  value={dnsDraft.type}
                  onChange={(e) =>
                    setDnsDraft({
                      ...dnsDraft,
                      type: e.target.value as DnsRecord["type"],
                    })
                  }
                >
                  <option value="A">A Record</option>
                  <option value="CNAME">CNAME</option>
                  <option value="SOA">SOA</option>
                  <option value="NS">NS</option>
                </select>
                {dnsDraft.type === "A" ? (
                  <input
                    className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-32 font-mono"
                    placeholder="Address"
                    value={dnsDraft.ip}
                    onChange={(e) =>
                      setDnsDraft({ ...dnsDraft, ip: e.target.value })
                    }
                  />
                ) : (
                  <input
                    className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-32 font-mono"
                    placeholder="Host / Server Name"
                    value={dnsDraft.target}
                    onChange={(e) =>
                      setDnsDraft({ ...dnsDraft, target: e.target.value })
                    }
                  />
                )}
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  onClick={() => {
                    if (!dnsDraft.name.trim()) return;
                    const rec: DnsRecord = {
                      name: dnsDraft.name.trim(),
                      type: dnsDraft.type,
                      ip: dnsDraft.type === "A" ? dnsDraft.ip : undefined,
                      target:
                        dnsDraft.type !== "A" ? dnsDraft.target : undefined,
                    };
                    patchSvc({
                      ...svc,
                      dns: {
                        ...svc.dns!,
                        records: [...svc.dns!.records, rec],
                      },
                    });
                    setDnsDraft({
                      name: "",
                      type: "A",
                      ip: "",
                      target: "",
                    });
                  }}
                >
                  Add
                </button>
              </div>
              <ul className="mt-2 space-y-0.5">
                {svc.dns.records.map((r, idx) => (
                  <li
                    key={`${r.name}-${idx}`}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>
                      {(r.type ?? "A").padEnd(6)} {r.name} →{" "}
                      {r.ip ?? r.target ?? "—"}
                    </span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          dns: {
                            ...svc.dns!,
                            records: svc.dns!.records.filter((_, i) => i !== idx),
                          },
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50 mt-2"
                onClick={() =>
                  window.alert(
                    `DNS Cache (${svc.dns?.cache?.length ?? 0} voci)\n` +
                      (svc.dns?.cache ?? [])
                        .map((c) => `${c.name} → ${c.ip}`)
                        .join("\n") ||
                      "(vuota)",
                  )
                }
              >
                DNS Cache
              </button>
            </Section>
          )}

          {top === "services" && svcNav === "syslog" && (
            <Section title="SYSLOG Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.syslog?.enabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      syslog: {
                        enabled: e.target.checked,
                        entries: svc.syslog?.entries ?? [],
                      },
                    })
                  }
                />
                Service On
              </label>
              <p className="mt-1 text-[11px] text-[#666]">
                Nessun parametro. Riceve log da router/switch (Time, HostName,
                Message).
              </p>
              <table className="mt-2 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#ece9d8] text-left">
                    <th className="border p-1">Time</th>
                    <th className="border p-1">HostName</th>
                    <th className="border p-1">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {(svc.syslog?.entries ?? []).length === 0 ? (
                    <tr>
                      <td className="border p-1 text-[#888]" colSpan={3}>
                        (vuoto)
                      </td>
                    </tr>
                  ) : (
                    svc.syslog!.entries.map((e, i) => (
                      <tr key={i}>
                        <td className="border p-1 font-mono">{e.time}</td>
                        <td className="border p-1">{e.hostname}</td>
                        <td className="border p-1">{e.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Section>
          )}

          {top === "services" && svcNav === "aaa" && (
            <Section title="AAA Service (RADIUS / TACACS)">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.aaa?.enabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      aaa: {
                        enabled: e.target.checked,
                        clients: svc.aaa?.clients ?? [],
                        users: svc.aaa?.users ?? [],
                      },
                    })
                  }
                />
                Service On
              </label>
              <div className="mt-2 font-semibold">Network clients</div>
              <div className="flex flex-wrap gap-1">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                  placeholder="Client Name"
                  value={aaaClient.name}
                  onChange={(e) =>
                    setAaaClient({ ...aaaClient, name: e.target.value })
                  }
                />
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-28 font-mono"
                  placeholder="Client IP"
                  value={aaaClient.ip}
                  onChange={(e) =>
                    setAaaClient({ ...aaaClient, ip: e.target.value })
                  }
                />
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-20"
                  placeholder="Secret"
                  value={aaaClient.secret}
                  onChange={(e) =>
                    setAaaClient({ ...aaaClient, secret: e.target.value })
                  }
                />
                <select
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px]"
                  value={aaaClient.type}
                  onChange={(e) =>
                    setAaaClient({
                      ...aaaClient,
                      type: e.target.value as AaaClient["type"],
                    })
                  }
                >
                  <option value="radius">Radius</option>
                  <option value="tacacs">Tacacs</option>
                </select>
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  onClick={() => {
                    if (!aaaClient.name || !aaaClient.ip) return;
                    patchSvc({
                      ...svc,
                      aaa: {
                        enabled: svc.aaa?.enabled ?? true,
                        clients: [
                          ...(svc.aaa?.clients ?? []),
                          { ...aaaClient },
                        ],
                        users: svc.aaa?.users ?? [],
                      },
                    });
                    setAaaClient({
                      name: "",
                      ip: "",
                      secret: "cisco",
                      type: "radius",
                    });
                  }}
                >
                  +
                </button>
              </div>
              <ul className="mt-1">
                {(svc.aaa?.clients ?? []).map((c, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>
                      {c.type} {c.name} {c.ip}
                    </span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          aaa: {
                            ...svc.aaa!,
                            clients: svc.aaa!.clients.filter((_, i) => i !== idx),
                          },
                        })
                      }
                    >
                      −
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 font-semibold">Authorized users</div>
              <div className="flex flex-wrap gap-1">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-28"
                  placeholder="UserName"
                  value={aaaUser.username}
                  onChange={(e) =>
                    setAaaUser({ ...aaaUser, username: e.target.value })
                  }
                />
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-28"
                  placeholder="Password"
                  value={aaaUser.password}
                  onChange={(e) =>
                    setAaaUser({ ...aaaUser, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  onClick={() => {
                    if (!aaaUser.username.trim()) return;
                    const u: ServerUser = {
                      username: aaaUser.username.trim(),
                      password: aaaUser.password || "cisco",
                    };
                    patchSvc({
                      ...svc,
                      aaa: {
                        enabled: svc.aaa?.enabled ?? true,
                        clients: svc.aaa?.clients ?? [],
                        users: [...(svc.aaa?.users ?? []), u],
                      },
                    });
                    setAaaUser({ username: "", password: "" });
                  }}
                >
                  +
                </button>
              </div>
              <ul className="mt-1">
                {(svc.aaa?.users ?? []).map((u, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>{u.username}</span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          aaa: {
                            ...svc.aaa!,
                            users: svc.aaa!.users.filter((_, i) => i !== idx),
                          },
                        })
                      }
                    >
                      −
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {top === "services" && svcNav === "ntp" && (
            <Section title="NTP Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.ntp?.enabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      ntp: {
                        enabled: e.target.checked,
                        datetime:
                          svc.ntp?.datetime ?? new Date().toISOString(),
                        authEnabled: svc.ntp?.authEnabled ?? false,
                        authKey: svc.ntp?.authKey ?? "1",
                        authPassword: svc.ntp?.authPassword ?? "",
                      },
                    })
                  }
                />
                Service On
              </label>
              <Field label="Date / Time">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                  type="datetime-local"
                  value={
                    svc.ntp?.datetime
                      ? svc.ntp.datetime.slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      ntp: {
                        enabled: svc.ntp?.enabled ?? true,
                        datetime: new Date(e.target.value).toISOString(),
                        authEnabled: svc.ntp?.authEnabled ?? false,
                        authKey: svc.ntp?.authKey ?? "1",
                        authPassword: svc.ntp?.authPassword ?? "",
                      },
                    })
                  }
                />
              </Field>
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.ntp?.authEnabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      ntp: {
                        ...(svc.ntp ?? {
                          enabled: true,
                          datetime: new Date().toISOString(),
                          authKey: "1",
                          authPassword: "",
                        }),
                        authEnabled: e.target.checked,
                      },
                    })
                  }
                />
                Authentication Enable
              </label>
              {(svc.ntp?.authEnabled ?? false) && (
                <>
                  <Field label="Key">
                    <input
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                      value={svc.ntp?.authKey ?? ""}
                      onChange={(e) =>
                        patchSvc({
                          ...svc,
                          ntp: { ...svc.ntp!, authKey: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-32"
                      value={svc.ntp?.authPassword ?? ""}
                      onChange={(e) =>
                        patchSvc({
                          ...svc,
                          ntp: { ...svc.ntp!, authPassword: e.target.value },
                        })
                      }
                    />
                  </Field>
                </>
              )}
            </Section>
          )}

          {top === "services" && svcNav === "email" && (
            <Section title="Email Service (SMTP / POP3)">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.email?.enabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      email: {
                        enabled: e.target.checked,
                        smtp: svc.email?.smtp ?? true,
                        pop3: svc.email?.pop3 ?? true,
                        domain: svc.email?.domain ?? "lab.local",
                        users: svc.email?.users ?? [],
                      },
                    })
                  }
                />
                Service On
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.email?.smtp ?? true}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      email: { ...svc.email!, smtp: e.target.checked },
                    })
                  }
                />
                SMTP
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.email?.pop3 ?? true}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      email: { ...svc.email!, pop3: e.target.checked },
                    })
                  }
                />
                POP3
              </label>
              <Field label="Domain Name">
                <div className="flex gap-1">
                  <input
                    className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] font-mono"
                    value={svc.email?.domain ?? ""}
                    onChange={(e) =>
                      patchSvc({
                        ...svc,
                        email: {
                          enabled: svc.email?.enabled ?? true,
                          smtp: svc.email?.smtp ?? true,
                          pop3: svc.email?.pop3 ?? true,
                          domain: e.target.value,
                          users: svc.email?.users ?? [],
                        },
                      })
                    }
                  />
                  <button type="button" className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50">
                    Set
                  </button>
                </div>
              </Field>
              <div className="mt-2 font-semibold">User accounts</div>
              <div className="flex flex-wrap gap-1">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-28"
                  placeholder="User name"
                  value={emailUser.username}
                  onChange={(e) =>
                    setEmailUser({ ...emailUser, username: e.target.value })
                  }
                />
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-28"
                  placeholder="Password"
                  value={emailUser.password}
                  onChange={(e) =>
                    setEmailUser({ ...emailUser, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  onClick={() => {
                    if (!emailUser.username.trim()) return;
                    patchSvc({
                      ...svc,
                      email: {
                        enabled: svc.email?.enabled ?? true,
                        smtp: svc.email?.smtp ?? true,
                        pop3: svc.email?.pop3 ?? true,
                        domain: svc.email?.domain ?? "lab.local",
                        users: [
                          ...(svc.email?.users ?? []),
                          {
                            username: emailUser.username.trim(),
                            password: emailUser.password || "cisco",
                          },
                        ],
                      },
                    });
                    setEmailUser({ username: "", password: "" });
                  }}
                >
                  Add
                </button>
              </div>
              <ul className="mt-1">
                {(svc.email?.users ?? []).map((u, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>
                      {u.username}@{svc.email?.domain}
                    </span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          email: {
                            ...svc.email!,
                            users: svc.email!.users.filter((_, i) => i !== idx),
                          },
                        })
                      }
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {top === "services" && svcNav === "ftp" && (
            <Section title="FTP Service">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svc.ftp?.enabled ?? false}
                  onChange={(e) =>
                    patchSvc({
                      ...svc,
                      ftp: {
                        enabled: e.target.checked,
                        accounts: svc.ftp?.accounts ?? [],
                        files: svc.ftp?.files ?? [],
                      },
                    })
                  }
                />
                Service On
              </label>
              <div className="mt-2 font-semibold">FTP accounts</div>
              <div className="flex flex-wrap items-center gap-1">
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                  placeholder="UserName"
                  value={ftpDraft.username}
                  onChange={(e) =>
                    setFtpDraft({ ...ftpDraft, username: e.target.value })
                  }
                />
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 text-[12px] w-24"
                  placeholder="Password"
                  value={ftpDraft.password}
                  onChange={(e) =>
                    setFtpDraft({ ...ftpDraft, password: e.target.value })
                  }
                />
                {(
                  [
                    ["write", "Write"],
                    ["read", "Read"],
                    ["delete", "Delete"],
                    ["rename", "Rename"],
                    ["list", "List"],
                  ] as const
                ).map(([k, lab]) => (
                  <label key={k} className="flex items-center gap-0.5 text-[11px]">
                    <input
                      type="checkbox"
                      checked={ftpDraft[k]}
                      onChange={(e) =>
                        setFtpDraft({ ...ftpDraft, [k]: e.target.checked })
                      }
                    />
                    {lab}
                  </label>
                ))}
                <button
                  type="button"
                  className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 text-[12px] hover:bg-white disabled:opacity-50"
                  onClick={() => {
                    if (!ftpDraft.username.trim()) return;
                    const acc: FtpAccount = {
                      username: ftpDraft.username.trim(),
                      password: ftpDraft.password || "cisco",
                      permissions: {
                        write: ftpDraft.write,
                        read: ftpDraft.read,
                        delete: ftpDraft.delete,
                        rename: ftpDraft.rename,
                        list: ftpDraft.list,
                      },
                    };
                    patchSvc({
                      ...svc,
                      ftp: {
                        enabled: svc.ftp?.enabled ?? true,
                        accounts: [...(svc.ftp?.accounts ?? []), acc],
                        files: svc.ftp?.files ?? [],
                      },
                    });
                    setFtpDraft({ ...ftpDraft, username: "", password: "cisco" });
                  }}
                >
                  Add
                </button>
              </div>
              <ul className="mt-1">
                {(svc.ftp?.accounts ?? []).map((a, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>
                      {a.username} [
                      {[
                        a.permissions.write && "W",
                        a.permissions.read && "R",
                        a.permissions.delete && "D",
                        a.permissions.rename && "N",
                        a.permissions.list && "L",
                      ]
                        .filter(Boolean)
                        .join("")}
                      ]
                    </span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          ftp: {
                            ...svc.ftp!,
                            accounts: svc.ftp!.accounts.filter(
                              (_, i) => i !== idx,
                            ),
                          },
                        })
                      }
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 font-semibold">Files</div>
              <ul>
                {(svc.ftp?.files ?? []).map((f, idx) => (
                  <li
                    key={f.name}
                    className="flex justify-between font-mono text-[11px]"
                  >
                    <span>
                      {f.name} ({f.size} B)
                    </span>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() =>
                        patchSvc({
                          ...svc,
                          ftp: {
                            ...svc.ftp!,
                            files: svc.ftp!.files.filter((_, i) => i !== idx),
                          },
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 border-b border-[#aca899] pb-1 text-[13px] font-bold text-[#003c74]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-1 flex items-center justify-between gap-2">
      <span className="min-w-[8rem]">{label}</span>
      {children}
    </label>
  );
}

function NavGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <div className="px-1 text-[10px] font-bold uppercase text-[#666]">
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full truncate px-2 py-0.5 text-left ${
        active ? "bg-[#316ac5] text-white" : "hover:bg-[#d4d0c8]"
      }`}
    >
      {children}
    </button>
  );
}
