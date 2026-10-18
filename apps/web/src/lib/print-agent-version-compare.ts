/**
 * Sole store-agent semver compare for dashboard “behind” hints.
 * Matches fiscal-agent Go `agentVersionOlderThan` (strict less-than on x.y.z).
 */
export function agentVersionOlderThan(current: string, recommended: string): boolean {
  const cur = parseSemverTriple(current);
  const rec = parseSemverTriple(recommended);
  if (!cur || !rec) {
    const a = current.trim();
    const b = recommended.trim();
    return a !== '' && b !== '' && a !== b;
  }
  if (cur[0] !== rec[0]) return cur[0] < rec[0];
  if (cur[1] !== rec[1]) return cur[1] < rec[1];
  return cur[2] < rec[2];
}

function parseSemverTriple(s: string): [number, number, number] | null {
  let t = s.trim();
  if (t.startsWith('v') || t.startsWith('V')) t = t.slice(1);
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length < 1) return null;
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const seg = i < parts.length ? parts[i] : '0';
    if (!/^\d+$/.test(seg)) return null;
    out[i] = Number.parseInt(seg, 10);
  }
  return out;
}
