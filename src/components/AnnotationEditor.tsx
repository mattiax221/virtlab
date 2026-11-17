"use client";

import type { Annotation } from "@/lib/network/types";

const COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#e2e8f0",
];

export function AnnotationEditor({
  annotation,
  onSave,
  onClose,
  onDelete,
}: {
  annotation: Annotation;
  onSave: (patch: Partial<Omit<Annotation, "id" | "kind">>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              {annotation.kind === "circle" ? "Cerchio / zona" : "Testo"}
            </div>
            <div className="text-xs text-slate-400">
              Utile per etichettare VLAN o aree del lab
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <label className="block space-y-1 text-xs text-slate-400">
            {annotation.kind === "circle" ? "Etichetta" : "Testo"}
            <input
              autoFocus
              defaultValue={annotation.label}
              id="ann-label"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </label>

          <div className="space-y-1 text-xs text-slate-400">
            Colore
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => onSave({ color: c })}
                  className={`h-7 w-7 rounded-full border-2 ${
                    annotation.color === c ? "border-white" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {annotation.kind === "circle" && (
            <label className="block space-y-1 text-xs text-slate-400">
              Raggio ({annotation.radius ?? 90}px)
              <input
                type="range"
                min={40}
                max={280}
                defaultValue={annotation.radius ?? 90}
                id="ann-radius"
                className="w-full"
                onChange={(e) => onSave({ radius: Number(e.target.value) })}
              />
            </label>
          )}

          {annotation.kind === "text" && (
            <label className="block space-y-1 text-xs text-slate-400">
              Dimensione ({annotation.fontSize ?? 16}px)
              <input
                type="range"
                min={12}
                max={36}
                defaultValue={annotation.fontSize ?? 16}
                id="ann-font"
                className="w-full"
                onChange={(e) => onSave({ fontSize: Number(e.target.value) })}
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-700 bg-slate-950/80 px-4 py-3">
          <button
            type="button"
            className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            onClick={() => {
              const label =
                (document.getElementById("ann-label") as HTMLInputElement | null)
                  ?.value ?? annotation.label;
              onSave({ label: label.trim() || annotation.label });
              onClose();
            }}
          >
            Salva
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            onClick={onClose}
          >
            Chiudi
          </button>
          <button
            type="button"
            className="ml-auto rounded-md px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-950"
            onClick={onDelete}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}
