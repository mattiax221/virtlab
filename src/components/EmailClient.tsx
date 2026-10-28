"use client";

import { useMemo, useState } from "react";
import { fetchMail, markMailRead, sendMail } from "@/lib/network/email";
import type { Device, LabState, MailMessage } from "@/lib/network/types";

export function EmailClient({
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
  const servers = useMemo(
    () =>
      stateRef.current.devices.filter((d) => d.services?.email?.enabled),
    [stateRef],
  );
  const defaultServer = servers[0];
  const domain = defaultServer?.services?.email?.domain ?? "lab.local";

  const [user, setUser] = useState("studente");
  const [password, setPassword] = useState("cisco");
  const [logged, setLogged] = useState(false);
  const [tab, setTab] = useState<"inbox" | "compose">("inbox");
  const [status, setStatus] = useState("Non connesso.");
  const [inbox, setInbox] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [compose, setCompose] = useState({
    to: "admin",
    subject: "",
    body: "",
  });

  function refresh() {
    const res = fetchMail(stateRef.current, device.id, {
      user,
      password,
      serverHint:
        defaultServer?.interfaces.find((i) => i.ip)?.ip ?? undefined,
    });
    stateRef.current = res.state;
    setState(res.state);
    setInbox(res.messages);
    setStatus(res.message);
    return res;
  }

  function login() {
    const res = refresh();
    if (res.message.includes("fallito") || res.message.includes("non ")) {
      setLogged(false);
      return;
    }
    setLogged(true);
    setTab("inbox");
  }

  function doSend() {
    const res = sendMail(stateRef.current, device.id, {
      fromUser: user,
      password,
      to: compose.to.includes("@") ? compose.to : `${compose.to}@${domain}`,
      subject: compose.subject,
      body: compose.body,
      serverHint:
        defaultServer?.interfaces.find((i) => i.ip)?.ip ?? undefined,
    });
    stateRef.current = res.state;
    setState(res.state);
    setStatus(res.message);
    if (res.message.startsWith("250")) {
      setCompose({ to: "admin", subject: "", body: "" });
      setTab("inbox");
      refresh();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">Email — {device.name}</span>
        <button type="button" className="px-2 hover:bg-rose-600" onClick={onClose}>
          ✕
        </button>
      </div>

      {!logged ? (
        <div className="space-y-2 p-4">
          <p className="text-[11px] text-[#555]">
            Server: {defaultServer?.name ?? "(nessuno)"} · dominio{" "}
            <span className="font-mono">{domain}</span>
          </p>
          <label className="flex flex-col gap-0.5">
            User
            <input
              className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            Password
            <input
              type="password"
              className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 hover:bg-white"
            onClick={login}
          >
            Accedi (POP3)
          </button>
          <p className="text-[11px] text-[#666]">
            Default: studente / cisco oppure admin / cisco
          </p>
          <p className="text-[11px] text-[#a00]">{status}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 border-b border-[#aca899] bg-[#ece9d8] px-2 py-1">
            <button
              type="button"
              className={`px-2 py-0.5 ${tab === "inbox" ? "bg-white font-semibold" : ""}`}
              onClick={() => {
                setTab("inbox");
                refresh();
              }}
            >
              Inbox
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 ${tab === "compose" ? "bg-white font-semibold" : ""}`}
              onClick={() => setTab("compose")}
            >
              Nuovo
            </button>
            <button
              type="button"
              className="ml-auto px-2 text-[#555] hover:text-black"
              onClick={() => {
                setLogged(false);
                setSelected(null);
              }}
            >
              Esci
            </button>
          </div>
          <div className="border-b border-[#aca899] bg-white px-2 py-0.5 text-[11px] text-[#555]">
            {status}
          </div>
          {tab === "inbox" ? (
            <div className="flex min-h-0 flex-1">
              <ul className="w-2/5 min-w-[140px] overflow-y-auto border-r border-[#aca899] bg-white">
                {inbox.length === 0 && (
                  <li className="p-3 text-[#888]">Casella vuota</li>
                )}
                {inbox.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`block w-full border-b border-[#eee] px-2 py-2 text-left hover:bg-[#e8f0fe] ${
                        selected?.id === m.id ? "bg-[#e8f0fe]" : ""
                      }`}
                      onClick={() => {
                        setSelected(m);
                        if (defaultServer) {
                          const next = markMailRead(
                            stateRef.current,
                            defaultServer.id,
                            user,
                            m.id,
                          );
                          stateRef.current = next;
                          setState(next);
                          setInbox((prev) =>
                            prev.map((x) =>
                              x.id === m.id ? { ...x, read: true } : x,
                            ),
                          );
                        }
                      }}
                    >
                      <div
                        className={`truncate ${m.read ? "font-normal" : "font-bold"}`}
                      >
                        {m.subject}
                      </div>
                      <div className="truncate text-[10px] text-[#666]">
                        {m.from}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-h-0 flex-1 overflow-y-auto bg-white p-3">
                {selected ? (
                  <>
                    <div className="font-semibold">{selected.subject}</div>
                    <div className="mt-1 text-[11px] text-[#555]">
                      Da: {selected.from}
                      <br />
                      A: {selected.to}
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-[12px]">
                      {selected.body}
                    </pre>
                  </>
                ) : (
                  <p className="text-[#888]">Seleziona un messaggio</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto p-3">
              <label className="flex flex-col gap-0.5">
                A
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
                  value={compose.to}
                  onChange={(e) =>
                    setCompose((c) => ({ ...c, to: e.target.value }))
                  }
                  placeholder={`admin o admin@${domain}`}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                Oggetto
                <input
                  className="rounded-none border border-[#7f9db9] bg-white px-1 py-0.5"
                  value={compose.subject}
                  onChange={(e) =>
                    setCompose((c) => ({ ...c, subject: e.target.value }))
                  }
                />
              </label>
              <textarea
                className="min-h-[140px] w-full rounded-none border border-[#7f9db9] bg-white p-2"
                value={compose.body}
                onChange={(e) =>
                  setCompose((c) => ({ ...c, body: e.target.value }))
                }
              />
              <button
                type="button"
                className="rounded-none border border-[#003c74] bg-[#ece9d8] px-3 py-1 hover:bg-white"
                onClick={doSend}
              >
                Invia (SMTP)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
