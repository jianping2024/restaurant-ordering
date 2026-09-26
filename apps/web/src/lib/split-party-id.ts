/**
 * Sole by-item atomic ticket id (one collect/print cycle).
 * Optional on the wire — old clients omit it; identity then falls back to name.
 */
import { mintBrowserUuid } from '@/lib/browser-uuid';
import { splitPersonKey } from '@/lib/split-person-identity';

const PARTY_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sole mint for a new by-item ticket (`party_id`). */
export function mintSplitPartyId(): string {
  return mintBrowserUuid();
}

/**
 * Sole wire parse for optional `party_id` on checkout/split payloads.
 * Invalid or missing → undefined (compat: treat as omitted, do not 400).
 * Accepts snake_case `party_id` or legacy camelCase `partyId` on the same object.
 */
export function parseOptionalPartyId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const id = raw.trim();
  if (!id || !PARTY_ID_UUID_RE.test(id)) return undefined;
  return id;
}

/** Read optional ticket id from a payload row (`party_id` preferred, else `partyId`). */
export function parseOptionalPartyIdFromRow(
  row: Record<string, unknown>,
): string | undefined {
  return parseOptionalPartyId(row.party_id) ?? parseOptionalPartyId(row.partyId);
}

/**
 * Sole map from in-memory calc row (`partyId`) → persisted/API `SplitResult` (`party_id`).
 * Drops camelCase `partyId` so checkout request never double-keys the same id.
 */
export function toWireSplitResult(row: {
  name: string;
  amount: number;
  partyId?: string;
  party_id?: string;
  paid?: boolean;
  items?: { name: string; qty: number; price: number }[];
}): {
  name: string;
  amount: number;
  paid?: boolean;
  party_id?: string;
  items?: { name: string; qty: number; price: number }[];
} {
  const party_id =
    parseOptionalPartyId(row.party_id) ?? parseOptionalPartyId(row.partyId);
  return {
    name: row.name,
    amount: row.amount,
    ...(row.paid != null ? { paid: row.paid } : {}),
    ...(row.items?.length ? { items: row.items } : {}),
    ...(party_id ? { party_id } : {}),
  };
}

/**
 * Sole identity key for a by-item ticket in maps / matching.
 * Prefer `party_id` when present; else legacy name key (compat).
 */
export function splitPartyKey(
  partyId: string | null | undefined,
  name: string,
): string {
  const id = typeof partyId === 'string' ? partyId.trim() : '';
  if (id) return `p:${id}`;
  const nameKey = splitPersonKey(name);
  return nameKey ? `n:${nameKey}` : '';
}
