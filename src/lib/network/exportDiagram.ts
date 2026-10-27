import { CABLE_META } from "./catalog";
import { serializeLab } from "./persist";
import { shortPortName } from "./portSort";
import { DEVICE_META, type LabState } from "./types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bounds(state: LabState) {
  if (state.devices.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 500, w: 800, h: 500 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of state.devices) {
    minX = Math.min(minX, d.x - 60);
    minY = Math.min(minY, d.y - 50);
    maxX = Math.max(maxX, d.x + 60);
    maxY = Math.max(maxY, d.y + 50);
  }
  const pad = 40;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: Math.max(400, maxX - minX),
    h: Math.max(300, maxY - minY),
  };
}

/** SVG topologia (sfondo chiaro, adatto a stampa / lezioni). */
export function buildTopologySvg(state: LabState): string {
  const b = bounds(state);
  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w)}" height="${Math.round(b.h)}" viewBox="${b.minX} ${b.minY} ${b.w} ${b.h}">`,
  );
  lines.push(`<rect x="${b.minX}" y="${b.minY}" width="${b.w}" height="${b.h}" fill="#0f172a"/>`);
  lines.push(`<text x="${b.minX + 16}" y="${b.minY + 24}" fill="#94a3b8" font-size="14" font-family="system-ui">NetLab</text>`);

  for (const link of state.links) {
    const a = state.devices.find((d) => d.id === link.aDeviceId);
    const c = state.devices.find((d) => d.id === link.bDeviceId);
    if (!a || !c) continue;
    const meta = CABLE_META[link.media] ?? CABLE_META.straight;
    const aIf = a.interfaces.find((i) => i.id === link.aIfaceId);
    const bIf = c.interfaces.find((i) => i.id === link.bIfaceId);
    const dash = meta.dash ? ` stroke-dasharray="${meta.dash}"` : "";
    lines.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${meta.color}" stroke-width="2.5" stroke-opacity="0.9"${dash}/>`,
    );
    const ax = a.x + (c.x - a.x) * 0.2;
    const ay = a.y + (c.y - a.y) * 0.2;
    const bx = a.x + (c.x - a.x) * 0.8;
    const by = a.y + (c.y - a.y) * 0.8;
    if (aIf) {
      lines.push(
        `<rect x="${ax - 22}" y="${ay - 18}" width="44" height="14" rx="3" fill="#020617" fill-opacity="0.85"/>`,
      );
      lines.push(
        `<text x="${ax}" y="${ay - 7}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-family="ui-monospace,monospace">${shortPortName(aIf.name)}</text>`,
      );
    }
    if (bIf) {
      lines.push(
        `<rect x="${bx - 22}" y="${by - 18}" width="44" height="14" rx="3" fill="#020617" fill-opacity="0.85"/>`,
      );
      lines.push(
        `<text x="${bx}" y="${by - 7}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-family="ui-monospace,monospace">${shortPortName(bIf.name)}</text>`,
      );
    }
  }

  for (const d of state.devices) {
    const label = DEVICE_META[d.type]?.label ?? d.type;
    const ip = d.interfaces.find((i) => i.ip)?.ip;
    lines.push(`<circle cx="${d.x}" cy="${d.y}" r="18" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>`);
    lines.push(
      `<text x="${d.x}" y="${d.y + 34}" text-anchor="middle" fill="#f8fafc" font-size="11" font-family="system-ui" font-weight="600">${escapeXml(d.name)}</text>`,
    );
    lines.push(
      `<text x="${d.x}" y="${d.y + 48}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="system-ui">${escapeXml(label)}</text>`,
    );
    if (ip) {
      lines.push(
        `<text x="${d.x}" y="${d.y + 60}" text-anchor="middle" fill="#7dd3fc" font-size="9" font-family="ui-monospace,monospace">${escapeXml(ip)}</text>`,
      );
    }
  }

  lines.push(`</svg>`);
  return lines.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadSvg(state: LabState, filename = "netlab.svg") {
  const svg = buildTopologySvg(state);
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export async function downloadPng(state: LabState, filename = "netlab.png") {
  const svg = buildTopologySvg(state);
  const b = bounds(state);
  const img = new Image();
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(b.w);
    canvas.height = Math.ceil(b.h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponibile");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Inventario dispositivi/porte CSV (utile per relazioni). */
export function downloadInventoryCsv(state: LabState, filename = "netlab-inventory.csv") {
  const rows = [["device", "type", "ptModel", "interface", "media", "ip", "mask", "linked"]];
  for (const d of state.devices) {
    const meta = DEVICE_META[d.type];
    for (const i of d.interfaces.filter((x) => !x.parentIfaceId)) {
      rows.push([
        d.name,
        d.type,
        meta?.ptModel ?? "",
        i.name,
        i.media,
        i.ip ?? "",
        i.mask ?? "",
        i.connectedLinkId ? "yes" : "no",
      ]);
    }
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Snapshot HTML autonomo (apribile offline). */
export function downloadHtmlSnapshot(state: LabState, filename = "netlab.html") {
  const svg = buildTopologySvg(state);
  const json = serializeLab(state);
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<title>NetLab snapshot</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
header{padding:12px 16px;border-bottom:1px solid #334155}
main{padding:16px;overflow:auto}
pre{background:#020617;padding:12px;border-radius:8px;overflow:auto;font-size:12px}
</style>
</head>
<body>
<header><strong>NetLab</strong> — snapshot ${new Date().toISOString()}</header>
<main>
${svg}
<h2>JSON</h2>
<pre>${escapeXml(json)}</pre>
</main>
</body>
</html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
}
