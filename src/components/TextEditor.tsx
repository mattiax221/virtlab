"use client";

import { useState } from "react";

/**
 * Text Editor Desktop utility (Packet Tracer style).
 * Local scratchpad only — no network side effects.
 */
export function TextEditor({
  deviceName,
  onClose,
}: {
  deviceName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("untitled.txt");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Nuovo file.");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f0f0] text-[12px] text-black">
      <div className="flex items-center justify-between border-b border-[#aca899] bg-gradient-to-b from-[#0a246a] to-[#a6caf0] px-2 py-1 text-white">
        <span className="font-semibold">
          Text Editor — {deviceName} · {name}
        </span>
        <button
          type="button"
          className="px-2 hover:bg-rose-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#aca899] bg-[#ece9d8] px-2 py-1">
        <button
          type="button"
          className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 hover:bg-white"
          onClick={() => {
            setName("untitled.txt");
            setBody("");
            setStatus("Nuovo file.");
          }}
        >
          New
        </button>
        <button
          type="button"
          className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 hover:bg-white"
          onClick={() => setStatus(`Aperto: ${name} (locale)`)}
        >
          Open
        </button>
        <button
          type="button"
          className="rounded-none border border-[#003c74] bg-[#ece9d8] px-2 py-0.5 hover:bg-white"
          onClick={() =>
            setStatus(`Salvato: ${name} (${body.length} caratteri, locale)`)
          }
        >
          Save
        </button>
        <input
          className="ml-2 w-40 rounded-none border border-[#7f9db9] bg-white px-1 py-0.5 font-mono"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="ml-auto text-[11px] text-[#555]">{status}</span>
      </div>
      <textarea
        className="min-h-0 flex-1 resize-none border-0 bg-white p-3 font-mono text-[13px] outline-none"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck={false}
        placeholder="Scrivi note di laboratorio…"
      />
    </div>
  );
}
