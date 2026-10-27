export function parseIp(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    value = (value << 8) + n;
  }
  return value >>> 0;
}

export function formatIp(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

export function parseMask(mask: string): number | null {
  const dotted = parseIp(mask);
  if (dotted !== null) {
    // Valid contiguous mask check
    const inverted = (~dotted) >>> 0;
    if ((inverted & (inverted + 1)) !== 0 && inverted !== 0) return null;
    return dotted;
  }
  if (/^\d+$/.test(mask.trim())) {
    const cidr = Number(mask.trim());
    if (cidr < 0 || cidr > 32) return null;
    if (cidr === 0) return 0;
    return (0xffffffff << (32 - cidr)) >>> 0;
  }
  return null;
}

export function maskToCidr(mask: string): number | null {
  const m = parseMask(mask);
  if (m === null) return null;
  let bits = 0;
  let value = m;
  for (let i = 0; i < 32; i++) {
    if (value & 0x80000000) bits++;
    else break;
    value <<= 1;
  }
  return bits;
}

export function sameSubnet(
  ipA: string,
  ipB: string,
  mask: string,
): boolean {
  const a = parseIp(ipA);
  const b = parseIp(ipB);
  const m = parseMask(mask);
  if (a === null || b === null || m === null) return false;
  return (a & m) === (b & m);
}

export function isValidIp(ip: string): boolean {
  return parseIp(ip) !== null;
}

export function randomMac(seed: string): string {
  // FNV-1a 32-bit — stable, well-spread for short seeds (deviceId-ifName)
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Mix further so consecutive seeds diverge in all octets
  let x = hash ^ (seed.length * 0x9e3779b9);
  const bytes = [0x02]; // locally administered, unicast
  for (let i = 0; i < 5; i++) {
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    bytes.push(x & 0xff);
    x = (x + 0x9e3779b9 + hash) >>> 0;
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(":");
}
