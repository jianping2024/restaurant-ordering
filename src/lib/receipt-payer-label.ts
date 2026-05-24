/** Default split-person labels from bill UI (any locale). */
const DEFAULT_GUEST_NAME_RE = /^(?:客人|Guest|Pessoa)\s*(\d+)$/iu;

/**
 * Payer line on thermal receipts already has a "Guest" prefix.
 * Strip placeholder labels so Latin printers never get Han (??) for unknown names.
 */
export function receiptPayerNameForPrint(
  name: string | undefined | null,
  personIndex: number,
): string | undefined {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    const n = personIndex + 1;
    return n > 0 ? String(n) : undefined;
  }
  const m = trimmed.match(DEFAULT_GUEST_NAME_RE);
  if (m?.[1]) return m[1];
  return trimmed;
}
