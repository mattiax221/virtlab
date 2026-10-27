import { parseLabJson, serializeLab } from "./persist";
import type { LabState } from "./types";

/** Compact URL-safe encoding of a lab (no server / no account). */
export async function encodeLabToHash(state: LabState): Promise<string> {
  const json = serializeLab(state);
  const bytes = new TextEncoder().encode(json);
  let compressed: Uint8Array;
  if (typeof CompressionStream !== "undefined") {
    const stream = new Blob([
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    ])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    compressed = bytes;
  }
  const b64 = bytesToBase64Url(compressed);
  return `v1.${b64}`;
}

export async function decodeLabFromHash(
  raw: string,
): Promise<{ state?: LabState; error?: string }> {
  try {
    const payload = raw.startsWith("#") ? raw.slice(1) : raw;
    const q = payload.includes("lab=")
      ? new URLSearchParams(
          payload.startsWith("?") || payload.includes("=")
            ? payload.replace(/^\?/, "").replace(/^#/, "")
            : `lab=${payload}`,
        ).get("lab")
      : payload.replace(/^lab=/, "");
    if (!q) return { error: "Nessun lab nell’URL." };

    let body = q;
    let useInflate = false;
    if (body.startsWith("v1.")) {
      body = body.slice(3);
      useInflate = true;
    }

    const bytes = base64UrlToBytes(body);
    let jsonBytes = bytes;
    if (useInflate && typeof DecompressionStream !== "undefined") {
      try {
        const stream = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        jsonBytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } catch {
        jsonBytes = bytes;
      }
    }
    const json = new TextDecoder().decode(jsonBytes);
    return parseLabJson(json);
  } catch {
    return { error: "URL lab non valido o troppo corrotti." };
  }
}

export async function buildShareUrl(state: LabState): Promise<string> {
  const encoded = await encodeLabToHash(state);
  const url = new URL(window.location.href);
  url.hash = `lab=${encoded}`;
  // Keep path on /lab
  if (!url.pathname.endsWith("/lab")) url.pathname = "/lab";
  return url.toString();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Read share payload from current location (hash or ?lab=). */
export function readShareParamFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("lab=")) return hash.slice(4);
  if (hash.startsWith("v1.")) return hash;
  const sp = new URLSearchParams(window.location.search);
  return sp.get("lab");
}
