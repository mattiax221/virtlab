"use client";

import { useEffect, useRef, useState } from "react";
import { completeLine } from "@/lib/cli-complete";

type Line = { kind: "in" | "out" | "sys"; text: string };

export function Terminal({
  prompt,
  welcome,
  onCommand,
  getCompletions,
  accent = "#4ade80",
  background = "#0b1220",
}: {
  prompt: string;
  welcome: string[];
  onCommand: (line: string) => { output: string; clear?: boolean };
  /** Dizionario dinamico (modo CLI / OS). Tab completa abbreviazioni stile Cisco/bash. */
  getCompletions?: () => string[];
  accent?: string;
  background?: string;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    welcome.map((text) => ({ kind: "sys" as const, text })),
  );
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTabRef = useRef<{ value: string; at: number } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function submit(raw: string) {
    const value = raw.replace(/\r/g, "");
    setLines((prev) => [...prev, { kind: "in", text: `${prompt} ${value}` }]);
    if (value.trim()) {
      setHistory((h) => [value, ...h].slice(0, 50));
    }
    setHistIdx(-1);
    setInput("");
    lastTabRef.current = null;
    const result = onCommand(value);
    if (result.clear) {
      setLines([]);
      return;
    }
    if (result.output) {
      setLines((prev) => [
        ...prev,
        ...result.output.split("\n").map((text) => ({ kind: "out" as const, text })),
      ]);
    }
  }

  function onTab() {
    if (!getCompletions) return;
    const dict = getCompletions();
    const result = completeLine(input, dict);
    const now = Date.now();
    const prev = lastTabRef.current;
    const doubleTab =
      prev &&
      prev.value === input &&
      now - prev.at < 900 &&
      result.suggestions &&
      result.suggestions.length > 0;

    if (result.value !== input) {
      setInput(result.value);
      lastTabRef.current = { value: result.value, at: now };
      return;
    }

    if (result.suggestions && result.suggestions.length > 0) {
      // Prima Tab ambigua: se non c'è progresso, mostra subito la lista
      // (o al secondo Tab sullo stesso input)
      if (doubleTab || !prev || prev.value !== input) {
        setLines((linesPrev) => [
          ...linesPrev,
          { kind: "in" as const, text: `${prompt} ${input}` },
          ...result.suggestions!.map((text) => ({
            kind: "sys" as const,
            text: `  ${text}`,
          })),
        ]);
        lastTabRef.current = { value: input, at: now };
      }
    } else {
      lastTabRef.current = { value: input, at: now };
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col font-mono text-[13px] leading-relaxed"
      style={{ background, color: accent }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.kind === "in"
                ? "text-sky-200"
                : line.kind === "sys"
                  ? "text-slate-400"
                  : "whitespace-pre-wrap text-emerald-300/90"
            }
          >
            {line.text || "\u00a0"}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-amber-200">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ color: accent, caretColor: accent }}
            onChange={(e) => {
              setInput(e.target.value);
              lastTabRef.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                onTab();
              } else if (e.key === "Enter") {
                e.preventDefault();
                submit(input);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const next = Math.min(histIdx + 1, history.length - 1);
                if (history[next] !== undefined) {
                  setHistIdx(next);
                  setInput(history[next]);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = histIdx - 1;
                if (next < 0) {
                  setHistIdx(-1);
                  setInput("");
                } else {
                  setHistIdx(next);
                  setInput(history[next] ?? "");
                }
              }
            }}
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
