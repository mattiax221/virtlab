import { Suspense } from "react";
import { LabWorkspace } from "@/components/LabWorkspace";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-slate-400">
          Caricamento NetLab…
        </div>
      }
    >
      <LabWorkspace />
    </Suspense>
  );
}
