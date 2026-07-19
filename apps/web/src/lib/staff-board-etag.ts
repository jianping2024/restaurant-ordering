import { createHash } from 'crypto';
import type { WaiterBoardData } from '@/lib/staff-board';

/** Stable JSON for ETag — sorted object keys, arrays keep order. */
export function canonicalizeForEtag(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

/** Strong ETag (quoted) for a waiter board snapshot. */
export function waiterBoardEtag(board: WaiterBoardData): string {
  const digest = createHash('sha256').update(canonicalizeForEtag(board)).digest('base64url');
  return `"${digest}"`;
}

export function etagsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}
