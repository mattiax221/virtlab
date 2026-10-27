"use client";

import { useState } from "react";
import type {
  Device,
  DeviceServices,
  DnsRecord,
  FtpAccount,
  LabState,
  ServerUser,
} from "@/lib/network/types";

type Tab =
  | "global"
  | "dhcp"
  | "dns"
  | "http"
  | "email"
  | "ftp"
  | "aaa";

const TABS: { id: Tab; label: string }[] = [
  { id: "global", label: "GLOBAL" },
  { id: "dhcp", label: "DHCP" },
  { id: "dns", label: "DNS" },
  { id: "http", label: "HTTP" },
  { id: "email", label: "EMAIL" },
  { id: "ftp", label: "FTP" },
  { id: "aaa", label: "AAA" },
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
  const [tab, setTab] = useState<Tab>("dhcp");
  const [dnsDraft, setDnsDraft] = useState({
    name: "",
    type: "A" as "A" | "CNAME" | "NS" | "SOA",
    ip: "",
    target: "",
  });
  const [userDraft, setUserDraft] = useState({ username: "", password: "" });
  const [ftpDraft, setFtpDraft] = useState({
    username: "",
    password: "",
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
    type: "radius" as "radius" | "tacacs",
  });

  function patch(nextServices: DeviceServices) {
    const next = {
      ...stateRef.current,
      devices: stateRef.current.devices.map((d) =>
        d.id === live.id ? { ...d, services: nextServices } : d,
      ),
    };
    stateRef.current = next;
    setState(next);
  }

  function patchIface(
    ifaceId: string,
    fields: Partial<{
      ip: string | null;
      mask: string | null;
      gateway: string | null;
      enabled: boolean;
      dhcpClient: boolean;
    }>,
  ) {
    const next = {
      ...stateRef.current,
      devices: stateRef.current.devices.map((d) => {
        if (d.id !== live.id) return d;
        return {
          ...d,
          interfaces: d.interfaces.map((i) =>
            i.id === ifaceId ? { ...i, ...fields } : i,
          ),
        };
      }),
    };
    stateRef.current = next;
    setState(next);
  }

  if (!svc) {
    return (
      <div className="p-4 text-sm text-slate-600">
        Nessun servizio su questo host.
        <button type="button" className="ml-2 underline" onClick={onClose}>
          Chiudi
        </button>
      </div>
    );
  }

  const ethIfaces = live.interfaces.filter(
    (i) => !i.parentIfaceId && (i.media === "ethernet" || i.media === "fiber"),
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black"
      style={{ fontFamily: "Segoe UI, Tahoma, sans-serif" }}
    >
      <div className="flex items-center justify-between border-b border-[#d4d4d4] bg-white px-2 py-1.5">
        <span className="text-[13px] font-semibold">
          Services — {live.name}{" "}
          <span className="font-normal text-[#666]">(Server-PT)</span>
        </span>
        <button
          type="button"
          className="px-2 hover:bg-rose-500 hover:text-white"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-0.5 border-b border-[#d4d4d4] bg-[#fafafa] px-1 pt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 text-[11px] ${
              tab === t.id
                ? "border border-b-0 border-[#d4d4d4] bg-white font-semibold"
                : "text-[#666] hover:text-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tab === "global" && (
          <>
            <p className="text-[11px] text-[#555]">
              Impostazioni globali e interfacce (docs PT Configuring Servers).
            </p>
            <label className="flex items-center justify-between gap-2">
              <span>Display Name</span>
              <input
                value={live.name}
                onChange={(e) => {
                  const next = {
                    ...stateRef.current,
                    devices: stateRef.current.devices.map((d) =>
                      d.id === live.id ? { ...d, name: e.target.value } : d,
                    ),
                  };
                  stateRef.current = next;
                  setState(next);
                }}
                className="w-48 border border-[#7a9cbc] px-1 py-0.5"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Domain Name</span>
              <input
                value={svc.domain ?? ""}
                onChange={(e) =>
                  patch({ ...svc, domain: e.target.value })
                }
                placeholder="lab.local"
                className="w-48 border border-[#7a9cbc] px-1 py-0.5 font-mono"
              />
            </label>
            <div className="rounded border border-[#d4d4d4] bg-white p-2">
              <div className="mb-2 font-medium">Interfacce</div>
              {ethIfaces.length === 0 ? (
                <div className="text-[#888]">Nessuna Ethernet — Physical</div>
              ) : (
                ethIfaces.map((i) => (
                  <div
                    key={i.id}
                    className="mb-2 grid gap-1 border-b border-[#eee] pb-2 last:border-0"
                  >
                    <div className="font-mono font-semibold">{i.name}</div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={i.enabled}
                        onChange={(e) =>
                          patchIface(i.id, { enabled: e.target.checked })
                        }
                      />
                      Port Status On
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>IP Address</span>
                      <input
                        value={i.ip ?? ""}
                        onChange={(e) =>
                          patchIface(i.id, {
                            ip: e.target.value || null,
                            dhcpClient: false,
                          })
                        }
                        className="w-36 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Subnet Mask</span>
                      <input
                        value={i.mask ?? ""}
                        onChange={(e) =>
                          patchIface(i.id, { mask: e.target.value || null })
                        }
                        className="w-36 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Default Gateway</span>
                      <input
                        value={i.gateway ?? ""}
                        onChange={(e) =>
                          patchIface(i.id, {
                            gateway: e.target.value || null,
                          })
                        }
                        className="w-36 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                      />
                    </label>
                    <div className="text-[10px] text-[#888]">
                      MAC {i.mac} · {i.media}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "dhcp" && svc.dhcp && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svc.dhcp.enabled}
                onChange={(e) =>
                  patch({
                    ...svc,
                    dhcp: { ...svc.dhcp!, enabled: e.target.checked },
                  })
                }
              />
              Service On
            </label>
            {(
              [
                ["network", "Network"],
                ["mask", "Subnet Mask"],
                ["gateway", "Default Gateway"],
                ["dns", "DNS Server"],
                ["startIp", "Start IP Address"],
                ["endIp", "End IP Address"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-2"
              >
                <span>{label}</span>
                <input
                  value={svc.dhcp![key]}
                  onChange={(e) =>
                    patch({
                      ...svc,
                      dhcp: { ...svc.dhcp!, [key]: e.target.value },
                    })
                  }
                  className="w-40 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                />
              </label>
            ))}
            <div className="rounded border border-[#d4d4d4] bg-white p-2">
              <div className="mb-1 font-medium">
                Leases ({svc.dhcp.leases.length})
              </div>
              {svc.dhcp.leases.length === 0 ? (
                <div className="text-[#888]">Nessuno</div>
              ) : (
                svc.dhcp.leases.map((l) => (
                  <div key={l.ifaceId} className="font-mono text-[11px]">
                    {l.ip} · {l.mac}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "dns" && svc.dns && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svc.dns.enabled}
                onChange={(e) =>
                  patch({
                    ...svc,
                    dns: { ...svc.dns!, enabled: e.target.checked },
                  })
                }
              />
              Service On
            </label>
            <div className="rounded border border-[#d4d4d4] bg-white p-2">
              <div className="mb-1 font-medium">Resource Records</div>
              <div className="mb-2 flex flex-wrap gap-1">
                <input
                  placeholder="Name"
                  value={dnsDraft.name}
                  onChange={(e) =>
                    setDnsDraft({ ...dnsDraft, name: e.target.value })
                  }
                  className="w-28 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                />
                <select
                  value={dnsDraft.type}
                  onChange={(e) =>
                    setDnsDraft({
                      ...dnsDraft,
                      type: e.target.value as typeof dnsDraft.type,
                    })
                  }
                  className="border border-[#7a9cbc] px-1 py-0.5"
                >
                  <option value="A">A</option>
                  <option value="CNAME">CNAME</option>
                  <option value="NS">NS</option>
                  <option value="SOA">SOA</option>
                </select>
                {dnsDraft.type === "A" ? (
                  <input
                    placeholder="Address"
                    value={dnsDraft.ip}
                    onChange={(e) =>
                      setDnsDraft({ ...dnsDraft, ip: e.target.value })
                    }
                    className="w-32 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                  />
                ) : (
                  <input
                    placeholder="Host / Target"
                    value={dnsDraft.target}
                    onChange={(e) =>
                      setDnsDraft({ ...dnsDraft, target: e.target.value })
                    }
                    className="w-32 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                  />
                )}
                <button
                  type="button"
                  className="border border-[#7a9cbc] bg-[#e8f0f8] px-2 py-0.5"
                  onClick={() => {
                    if (!dnsDraft.name.trim()) return;
                    const rec: DnsRecord = {
                      name: dnsDraft.name.trim(),
                      type: dnsDraft.type,
                      ip:
                        dnsDraft.type === "A"
                          ? dnsDraft.ip.trim()
                          : undefined,
                      target:
                        dnsDraft.type !== "A"
                          ? dnsDraft.target.trim()
                          : undefined,
                    };
                    patch({
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
              <ul className="space-y-0.5">
                {svc.dns.records.map((r, idx) => (
                  <li
                    key={`${r.name}-${idx}`}
                    className="flex items-center justify-between font-mono text-[11px]"
                  >
                    <span>
                      {(r.type ?? "A").padEnd(6)} {r.name} →{" "}
                      {r.ip ?? r.target ?? "—"}
                    </span>
                    <button
                      type="button"
                      className="text-rose-600"
                      onClick={() =>
                        patch({
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
            </div>
          </>
        )}

        {tab === "http" && svc.http && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svc.http.enabled}
                onChange={(e) =>
                  patch({
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
                  patch({
                    ...svc,
                    http: { ...svc.http!, https: e.target.checked },
                  })
                }
              />
              HTTPS On
            </label>
            <label className="flex flex-col gap-1">
              <span>Page title</span>
              <input
                value={svc.http.title}
                onChange={(e) =>
                  patch({
                    ...svc,
                    http: { ...svc.http!, title: e.target.value },
                  })
                }
                className="border border-[#7a9cbc] px-1 py-0.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>index.html / body</span>
              <textarea
                value={svc.http.body}
                onChange={(e) =>
                  patch({
                    ...svc,
                    http: { ...svc.http!, body: e.target.value },
                  })
                }
                rows={6}
                className="border border-[#7a9cbc] px-1 py-0.5 font-mono"
              />
            </label>
            {(svc.http.pages ?? []).length > 0 && (
              <div className="rounded border border-[#d4d4d4] bg-white p-2">
                <div className="mb-1 font-medium">Files</div>
                {svc.http.pages!.map((p) => (
                  <div key={p.name} className="font-mono text-[11px]">
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "email" && (
          <>
            {!svc.email && (
              <button
                type="button"
                className="border border-[#7a9cbc] bg-[#e8f0f8] px-2 py-1"
                onClick={() =>
                  patch({
                    ...svc,
                    email: {
                      enabled: true,
                      smtp: true,
                      pop3: true,
                      domain: svc.domain ?? "lab.local",
                      users: [],
                    },
                  })
                }
              >
                Abilita Email service
              </button>
            )}
            {svc.email && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svc.email.enabled}
                    onChange={(e) =>
                      patch({
                        ...svc,
                        email: { ...svc.email!, enabled: e.target.checked },
                      })
                    }
                  />
                  Service On
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svc.email.smtp}
                    onChange={(e) =>
                      patch({
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
                    checked={svc.email.pop3}
                    onChange={(e) =>
                      patch({
                        ...svc,
                        email: { ...svc.email!, pop3: e.target.checked },
                      })
                    }
                  />
                  POP3
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Domain Name</span>
                  <div className="flex gap-1">
                    <input
                      value={svc.email.domain}
                      onChange={(e) =>
                        patch({
                          ...svc,
                          email: { ...svc.email!, domain: e.target.value },
                        })
                      }
                      className="w-36 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                    />
                    <button
                      type="button"
                      className="border border-[#7a9cbc] bg-[#e8f0f8] px-2"
                      onClick={() =>
                        patch({
                          ...svc,
                          domain: svc.email!.domain,
                          email: { ...svc.email! },
                        })
                      }
                    >
                      Set
                    </button>
                  </div>
                </label>
                <div className="rounded border border-[#d4d4d4] bg-white p-2">
                  <div className="mb-1 font-medium">User accounts</div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    <input
                      placeholder="User"
                      value={userDraft.username}
                      onChange={(e) =>
                        setUserDraft({
                          ...userDraft,
                          username: e.target.value,
                        })
                      }
                      className="w-28 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <input
                      placeholder="Password"
                      type="password"
                      value={userDraft.password}
                      onChange={(e) =>
                        setUserDraft({
                          ...userDraft,
                          password: e.target.value,
                        })
                      }
                      className="w-28 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <button
                      type="button"
                      className="border border-[#7a9cbc] bg-[#e8f0f8] px-2"
                      onClick={() => {
                        if (!userDraft.username.trim()) return;
                        const u: ServerUser = {
                          username: userDraft.username.trim(),
                          password: userDraft.password || "cisco",
                        };
                        patch({
                          ...svc,
                          email: {
                            ...svc.email!,
                            users: [...svc.email!.users, u],
                          },
                        });
                        setUserDraft({ username: "", password: "" });
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {svc.email.users.map((u, idx) => (
                    <div
                      key={u.username + idx}
                      className="flex justify-between font-mono text-[11px]"
                    >
                      <span>
                        {u.username}@{svc.email!.domain}
                      </span>
                      <button
                        type="button"
                        className="text-rose-600"
                        onClick={() =>
                          patch({
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
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "ftp" && (
          <>
            {!svc.ftp && (
              <button
                type="button"
                className="border border-[#7a9cbc] bg-[#e8f0f8] px-2 py-1"
                onClick={() =>
                  patch({
                    ...svc,
                    ftp: { enabled: true, accounts: [], files: [] },
                  })
                }
              >
                Abilita FTP service
              </button>
            )}
            {svc.ftp && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svc.ftp.enabled}
                    onChange={(e) =>
                      patch({
                        ...svc,
                        ftp: { ...svc.ftp!, enabled: e.target.checked },
                      })
                    }
                  />
                  Service On
                </label>
                <div className="rounded border border-[#d4d4d4] bg-white p-2">
                  <div className="mb-1 font-medium">FTP accounts</div>
                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    <input
                      placeholder="User"
                      value={ftpDraft.username}
                      onChange={(e) =>
                        setFtpDraft({ ...ftpDraft, username: e.target.value })
                      }
                      className="w-24 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <input
                      placeholder="Pass"
                      value={ftpDraft.password}
                      onChange={(e) =>
                        setFtpDraft({ ...ftpDraft, password: e.target.value })
                      }
                      className="w-24 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    {(
                      [
                        ["write", "W"],
                        ["read", "R"],
                        ["delete", "D"],
                        ["rename", "N"],
                        ["list", "L"],
                      ] as const
                    ).map(([k, lab]) => (
                      <label key={k} className="flex items-center gap-0.5">
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
                      className="border border-[#7a9cbc] bg-[#e8f0f8] px-2"
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
                        patch({
                          ...svc,
                          ftp: {
                            ...svc.ftp!,
                            accounts: [...svc.ftp!.accounts, acc],
                          },
                        });
                        setFtpDraft({
                          ...ftpDraft,
                          username: "",
                          password: "",
                        });
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {svc.ftp.accounts.map((a, idx) => (
                    <div
                      key={a.username + idx}
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
                        className="text-rose-600"
                        onClick={() =>
                          patch({
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
                    </div>
                  ))}
                </div>
                <div className="rounded border border-[#d4d4d4] bg-white p-2">
                  <div className="mb-1 font-medium">Files</div>
                  {(svc.ftp.files ?? []).map((f) => (
                    <div key={f.name} className="font-mono text-[11px]">
                      {f.name} ({f.size} B)
                    </div>
                  ))}
                  {(svc.ftp.files ?? []).length === 0 && (
                    <div className="text-[#888]">Nessun file</div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === "aaa" && (
          <>
            {!svc.aaa && (
              <button
                type="button"
                className="border border-[#7a9cbc] bg-[#e8f0f8] px-2 py-1"
                onClick={() =>
                  patch({
                    ...svc,
                    aaa: { enabled: true, clients: [], users: [] },
                  })
                }
              >
                Abilita AAA (RADIUS/TACACS)
              </button>
            )}
            {svc.aaa && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svc.aaa.enabled}
                    onChange={(e) =>
                      patch({
                        ...svc,
                        aaa: { ...svc.aaa!, enabled: e.target.checked },
                      })
                    }
                  />
                  Service On
                </label>
                <div className="rounded border border-[#d4d4d4] bg-white p-2">
                  <div className="mb-1 font-medium">Network clients</div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    <input
                      placeholder="Client Name"
                      value={aaaClient.name}
                      onChange={(e) =>
                        setAaaClient({ ...aaaClient, name: e.target.value })
                      }
                      className="w-24 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <input
                      placeholder="Client IP"
                      value={aaaClient.ip}
                      onChange={(e) =>
                        setAaaClient({ ...aaaClient, ip: e.target.value })
                      }
                      className="w-28 border border-[#7a9cbc] px-1 py-0.5 font-mono"
                    />
                    <input
                      placeholder="Secret"
                      value={aaaClient.secret}
                      onChange={(e) =>
                        setAaaClient({ ...aaaClient, secret: e.target.value })
                      }
                      className="w-20 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <select
                      value={aaaClient.type}
                      onChange={(e) =>
                        setAaaClient({
                          ...aaaClient,
                          type: e.target.value as "radius" | "tacacs",
                        })
                      }
                      className="border border-[#7a9cbc] px-1 py-0.5"
                    >
                      <option value="radius">Radius</option>
                      <option value="tacacs">Tacacs</option>
                    </select>
                    <button
                      type="button"
                      className="border border-[#7a9cbc] bg-[#e8f0f8] px-2"
                      onClick={() => {
                        if (!aaaClient.name.trim() || !aaaClient.ip.trim())
                          return;
                        patch({
                          ...svc,
                          aaa: {
                            ...svc.aaa!,
                            clients: [
                              ...svc.aaa!.clients,
                              { ...aaaClient, name: aaaClient.name.trim() },
                            ],
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
                  {svc.aaa.clients.map((c, idx) => (
                    <div
                      key={c.name + idx}
                      className="flex justify-between font-mono text-[11px]"
                    >
                      <span>
                        {c.type.toUpperCase()} {c.name} {c.ip}
                      </span>
                      <button
                        type="button"
                        className="text-rose-600"
                        onClick={() =>
                          patch({
                            ...svc,
                            aaa: {
                              ...svc.aaa!,
                              clients: svc.aaa!.clients.filter(
                                (_, i) => i !== idx,
                              ),
                            },
                          })
                        }
                      >
                        −
                      </button>
                    </div>
                  ))}
                </div>
                <div className="rounded border border-[#d4d4d4] bg-white p-2">
                  <div className="mb-1 font-medium">Authorized users</div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    <input
                      placeholder="UserName"
                      value={userDraft.username}
                      onChange={(e) =>
                        setUserDraft({
                          ...userDraft,
                          username: e.target.value,
                        })
                      }
                      className="w-28 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <input
                      placeholder="Password"
                      value={userDraft.password}
                      onChange={(e) =>
                        setUserDraft({
                          ...userDraft,
                          password: e.target.value,
                        })
                      }
                      className="w-28 border border-[#7a9cbc] px-1 py-0.5"
                    />
                    <button
                      type="button"
                      className="border border-[#7a9cbc] bg-[#e8f0f8] px-2"
                      onClick={() => {
                        if (!userDraft.username.trim()) return;
                        patch({
                          ...svc,
                          aaa: {
                            ...svc.aaa!,
                            users: [
                              ...svc.aaa!.users,
                              {
                                username: userDraft.username.trim(),
                                password: userDraft.password || "cisco",
                              },
                            ],
                          },
                        });
                        setUserDraft({ username: "", password: "" });
                      }}
                    >
                      +
                    </button>
                  </div>
                  {svc.aaa.users.map((u, idx) => (
                    <div
                      key={u.username + idx}
                      className="flex justify-between font-mono text-[11px]"
                    >
                      <span>{u.username}</span>
                      <button
                        type="button"
                        className="text-rose-600"
                        onClick={() =>
                          patch({
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
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
