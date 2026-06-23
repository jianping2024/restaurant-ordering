/** Strip non-digits and cap at 9 characters (Portuguese NIF length). */
export function normalizePortugueseNif(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9);
}

/** Display as "123 456 789" when enough digits are present. */
export function formatPortugueseNif(raw: string): string {
  const digits = normalizePortugueseNif(raw);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Mod-11 check digit per Portuguese NIF rules. Empty input is treated as valid (optional field). */
export function validatePortugueseNif(raw: string): boolean {
  const nif = normalizePortugueseNif(raw);
  if (nif.length === 0) return true;
  if (nif.length !== 9 || nif[0] === '0') return false;

  const checkDigit = Number(nif[8]);
  const sum = nif
    .slice(0, 8)
    .split('')
    .reduce((acc, digit, i) => acc + Number(digit) * (9 - i), 0);
  let expected = 11 - (sum % 11);
  if (expected >= 10) expected = 0;
  return checkDigit === expected;
}

/** Returns normalized 9-digit NIF or null when empty/invalid. */
export function parsePortugueseNif(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = normalizePortugueseNif(raw.trim());
  if (!normalized) return null;
  return validatePortugueseNif(normalized) ? normalized : null;
}
