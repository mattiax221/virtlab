import { runPing, updateDevice } from "./engine";
import { getDevice } from "./engine-helpers";
import { resolveDnsQuery } from "./services";
import type { LabState, PrintJob } from "./types";

export type PrintResult = {
  ok: boolean;
  state: LabState;
  message: string;
  printerId?: string;
  printerIp?: string;
  job?: PrintJob;
};

/** Invia un job di stampa a un Printer-PT raggiungibile. */
export function sendPrintJob(
  state: LabState,
  fromDeviceId: string,
  target: string,
): PrintResult {
  let ip = target;
  let next = state;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    const q = resolveDnsQuery(next, fromDeviceId, target);
    next = q.state;
    if (!q.ip) {
      return {
        ok: false,
        state: next,
        message: `print: impossibile risolvere ${target}`,
      };
    }
    ip = q.ip;
  }

  const { result, state: afterPing } = runPing(next, fromDeviceId, ip);
  next = afterPing;
  if (!result.ok) {
    return {
      ok: false,
      state: next,
      message: `print: ${ip} non raggiungibile\n${result.message.split("\n")[0]}`,
    };
  }

  const printer = next.devices.find(
    (d) =>
      d.type === "printer" && d.interfaces.some((i) => i.ip === ip),
  );
  if (!printer) {
    return {
      ok: false,
      state: next,
      message: `print: nessun Printer-PT su ${ip}`,
    };
  }
  if (!printer.powered) {
    return {
      ok: false,
      state: next,
      message: `print: ${printer.name} è spenta`,
    };
  }

  const svc = printer.printerService ?? {
    enabled: true,
    shareName: printer.name,
    queue: [],
  };
  if (!svc.enabled) {
    return {
      ok: false,
      state: next,
      message: `print: servizio PRINT disabilitato su ${printer.name}`,
    };
  }

  const from = getDevice(next, fromDeviceId);
  const job: PrintJob = {
    id: `job-${Date.now().toString(36)}`,
    from: from?.name ?? fromDeviceId,
    pages: 1 + Math.floor(Math.random() * 3),
    status: "done",
    at: new Date().toLocaleTimeString("it-IT", { timeZone: "Europe/Rome" }),
  };

  next = updateDevice(next, printer.id, {
    printerService: {
      ...svc,
      queue: [job, ...svc.queue].slice(0, 30),
    },
  });

  return {
    ok: true,
    state: next,
    printerId: printer.id,
    printerIp: ip,
    job,
    message: [
      `Submitting job to \\\\${printer.name}\\${svc.shareName} (${ip})…`,
      `Job ${job.id} — ${job.pages} page(s) — ${job.status}`,
      `(coda stampante aggiornata)`,
    ].join("\n"),
  };
}
