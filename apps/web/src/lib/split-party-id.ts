/**
 * Sole by-item atomic ticket id (one collect/print cycle).
 * Optional on the wire — old clients omit it; identity then falls back to name.
 */
import { mintBrowserUuid } from '@/lib/browser-uuid';
import { splitPersonKey } from '@/lib/split-person-identity';

/** Sole mint for a new by-item ticket (`party_id`). */
export function mintSplitPartyId(): string {
  return mintBrowserUuid();
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
