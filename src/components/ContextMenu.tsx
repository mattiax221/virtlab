"use client";

export type MenuItem =
  | { type: "item"; label: string; shortcut?: string; danger?: boolean; disabled?: boolean; onClick: () => void }
  | { type: "sep" };

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const maxW = 220;
  const maxH = items.length * 32 + 8;
  const left = Math.min(x, typeof window !== "undefined" ? window.innerWidth - maxW - 8 : x);
  const top = Math.min(y, typeof window !== "undefined" ? window.innerHeight - maxH - 8 : y);

  return (
    <>
      <div className="fixed inset-0 z-[80]" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        role="menu"
        className="fixed z-[90] min-w-[200px] overflow-hidden rounded-md border border-slate-600/80 bg-slate-900/98 py-1 text-[13px] text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {items.map((item, i) =>
          item.type === "sep" ? (
            <div key={`s-${i}`} className="my-1 border-t border-slate-700/80" />
          ) : (
            <button
              key={`${item.label}-${i}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger
                  ? "text-rose-300 hover:bg-rose-950/60 hover:text-rose-100"
                  : "hover:bg-sky-600/90 hover:text-white"
              }`}
              onClick={() => {
                if (item.disabled) return;
                item.onClick();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-slate-500">{item.shortcut}</span>
              )}
            </button>
          ),
        )}
      </div>
    </>
  );
}
