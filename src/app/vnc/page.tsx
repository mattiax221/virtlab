import Link from "next/link";
import { VncPanel } from "@/components/VncPanel";

export default function VncPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#07111f] text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Link
          href="/lab"
          className="rounded bg-sky-700 px-2 py-1 text-xs font-semibold text-white"
        >
          ← Lab
        </Link>
        <div>
          <div className="font-display font-semibold">Windows via VNC</div>
          <div className="text-xs text-slate-400">
            QEMU + noVNC · solo ISO legittimo / Evaluation Microsoft
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4">
        <VncPanel />
      </main>
    </div>
  );
}
