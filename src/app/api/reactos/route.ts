import { spawnSync } from "child_process";
import { join } from "path";
import { connection, NextResponse } from "next/server";

function run(args: string[]) {
  const script = join(process.cwd(), "scripts", "reactos-pc.sh");
  const result = spawnSync(script, args, {
    encoding: "utf8",
    timeout: 60_000,
  });
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  if (result.status !== 0 && !stdout) {
    return {
      ok: false as const,
      error: stderr || `exit ${result.status}`,
    };
  }
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return { ok: false, error: stdout || stderr || "parse error" };
  }
}

export async function GET() {
  await connection();
  return NextResponse.json(run(["status"]));
}

export async function POST(req: Request) {
  await connection();
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    deviceId?: string;
  };
  if (body.action === "stop") {
    return NextResponse.json(run(["stop"]));
  }
  if (body.action === "start" && body.deviceId) {
    return NextResponse.json(run(["start", body.deviceId]));
  }
  return NextResponse.json({ ok: false, error: "action non valida" }, { status: 400 });
}
