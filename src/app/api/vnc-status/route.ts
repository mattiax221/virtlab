import { existsSync } from "fs";
import { connect } from "net";
import { join } from "path";
import { connection, NextResponse } from "next/server";

function portOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(400);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

export async function GET() {
  await connection();
  const root = process.cwd();
  const isoPresent = existsSync(join(root, "vm", "windows.iso"));
  const diskPresent = existsSync(join(root, "vm", "windows.qcow2"));
  const [vncUp, novncUp] = await Promise.all([
    portOpen(5902),
    portOpen(6080),
  ]);

  let message =
    "Metti un ISO Windows Evaluation in vm/windows.iso, poi avvia gli script.";
  if (!isoPresent) {
    message =
      "Manca vm/windows.iso — scarica Evaluation da Microsoft (niente copie pirata).";
  } else if (!vncUp) {
    message = "ISO presente. Avvia ./scripts/start-windows-vm.sh";
  } else if (!novncUp) {
    message = "VNC attivo. Avvia ./scripts/start-novnc.sh per il browser.";
  } else {
    message = "VM e noVNC attivi — usa il pannello o Apri noVNC.";
  }

  return NextResponse.json({
    isoPresent,
    diskPresent,
    vncUp,
    novncUp,
    message,
  });
}
