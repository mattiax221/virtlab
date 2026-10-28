import { getDevice } from "./engine-helpers";
import { runPing } from "./engine";
import { resolveDnsQuery } from "./services";
import type { LabState, MailMessage } from "./types";

function uid(): string {
  return `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function findMailServer(
  state: LabState,
  hint?: string,
): { state: LabState; serverId: string; domain: string } | { error: string } {
  let next = state;
  if (hint) {
    let ip = hint;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(hint)) {
      // try mail.lab or domain
      const q = resolveDnsQuery(next, state.devices[0]?.id ?? "", hint);
      next = q.state;
      if (q.ip) ip = q.ip;
    }
    const byIp = next.devices.find(
      (d) =>
        d.services?.email?.enabled &&
        d.interfaces.some((i) => i.ip === ip),
    );
    if (byIp?.services?.email) {
      return {
        state: next,
        serverId: byIp.id,
        domain: byIp.services.email.domain,
      };
    }
  }
  const any = next.devices.find((d) => d.services?.email?.enabled);
  if (!any?.services?.email) return { error: "Nessun server EMAIL attivo." };
  return {
    state: next,
    serverId: any.id,
    domain: any.services.email.domain,
  };
}

export function sendMail(
  state: LabState,
  fromDeviceId: string,
  opts: {
    serverHint?: string;
    fromUser: string;
    password: string;
    to: string; // user or user@domain
    subject: string;
    body: string;
  },
): { state: LabState; message: string } {
  const found = findMailServer(state, opts.serverHint);
  if ("error" in found) return { state, message: found.error };
  let next = found.state;
  const server = getDevice(next, found.serverId);
  const email = server?.services?.email;
  if (!server || !email?.enabled) {
    return { state: next, message: "Servizio EMAIL non disponibile." };
  }
  if (!email.smtp) return { state: next, message: "SMTP disabilitato sul server." };

  const serverIp = server.interfaces.find((i) => i.ip)?.ip;
  if (serverIp) {
    const ping = runPing(next, fromDeviceId, serverIp);
    next = ping.state;
    if (!ping.result.ok) {
      return {
        state: next,
        message: `SMTP: server ${serverIp} non raggiungibile.`,
      };
    }
  }

  const user = email.users.find((u) => u.username === opts.fromUser);
  if (!user || user.password !== opts.password) {
    return { state: next, message: "Autenticazione SMTP fallita." };
  }

  const toLocal = opts.to.includes("@")
    ? opts.to.split("@")[0]!
    : opts.to;
  const toDomain = opts.to.includes("@")
    ? opts.to.split("@")[1]!
    : email.domain;
  if (toDomain.toLowerCase() !== email.domain.toLowerCase()) {
    return {
      state: next,
      message: `Dominio ${toDomain} non gestito (atteso ${email.domain}).`,
    };
  }
  if (!email.users.some((u) => u.username === toLocal)) {
    return { state: next, message: `Utente ${toLocal}@${email.domain} inesistente.` };
  }

  const msg: MailMessage = {
    id: uid(),
    from: `${opts.fromUser}@${email.domain}`,
    to: `${toLocal}@${email.domain}`,
    subject: opts.subject || "(nessun oggetto)",
    body: opts.body,
    time: new Date().toISOString(),
    read: false,
  };
  const boxes = { ...(email.mailboxes ?? {}) };
  boxes[toLocal] = [msg, ...(boxes[toLocal] ?? [])].slice(0, 100);

  next = {
    ...next,
    devices: next.devices.map((d) =>
      d.id === server.id
        ? {
            ...d,
            services: {
              ...d.services,
              email: { ...email, mailboxes: boxes },
            },
          }
        : d,
    ),
  };
  return {
    state: next,
    message: `250 OK — messaggio consegnato a ${msg.to}`,
  };
}

export function fetchMail(
  state: LabState,
  fromDeviceId: string,
  opts: { serverHint?: string; user: string; password: string },
): { state: LabState; messages: MailMessage[]; message: string } {
  const found = findMailServer(state, opts.serverHint);
  if ("error" in found) {
    return { state, messages: [], message: found.error };
  }
  let next = found.state;
  const server = getDevice(next, found.serverId);
  const email = server?.services?.email;
  if (!server || !email?.enabled) {
    return { state: next, messages: [], message: "EMAIL non disponibile." };
  }
  if (!email.pop3) {
    return { state: next, messages: [], message: "POP3 disabilitato." };
  }
  const serverIp = server.interfaces.find((i) => i.ip)?.ip;
  if (serverIp) {
    const ping = runPing(next, fromDeviceId, serverIp);
    next = ping.state;
    if (!ping.result.ok) {
      return {
        state: next,
        messages: [],
        message: `POP3: server ${serverIp} non raggiungibile.`,
      };
    }
  }
  const user = email.users.find((u) => u.username === opts.user);
  if (!user || user.password !== opts.password) {
    return { state: next, messages: [], message: "Login POP3 fallito." };
  }
  const messages = email.mailboxes?.[opts.user] ?? [];
  return {
    state: next,
    messages,
    message: `${messages.length} messaggio/i in ${opts.user}@${email.domain}`,
  };
}

export function markMailRead(
  state: LabState,
  serverId: string,
  username: string,
  mailId: string,
): LabState {
  return {
    ...state,
    devices: state.devices.map((d) => {
      if (d.id !== serverId || !d.services?.email) return d;
      const email = d.services.email;
      const box = (email.mailboxes?.[username] ?? []).map((m) =>
        m.id === mailId ? { ...m, read: true } : m,
      );
      return {
        ...d,
        services: {
          ...d.services,
          email: {
            ...email,
            mailboxes: { ...email.mailboxes, [username]: box },
          },
        },
      };
    }),
  };
}
