const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Strip to at most four digits for HH:MM entry (mobile numeric keyboard). */
function hmDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

/**
 * Live mask while typing digits: auto-inserts ":" and rejects digits that would
 * make hour > 23 or minutes > 59.
 */
export function formatHmDigitsWhileTyping(raw: string): string {
  let digits = hmDigitsOnly(raw);

  if (digits.length >= 2) {
    const hh = parseInt(digits.slice(0, 2), 10);
    if (hh > 23) digits = digits.slice(0, 1);
  }

  if (digits.length === 4) {
    const mm = parseInt(digits.slice(2, 4), 10);
    if (mm > 59) digits = digits.slice(0, 3);
  }

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeHmFromDigits(digits: string): string | null {
  if (!digits) return null;

  if (digits.length === 1) {
    const h = parseInt(digits, 10);
    if (h > 9) return null;
    return `0${h}:00`;
  }

  if (digits.length === 2) {
    const h = parseInt(digits, 10);
    if (h > 23) return null;
    return `${digits.padStart(2, '0')}:00`;
  }

  const padded = digits.padStart(4, '0');
  const h = padded.slice(0, -2);
  const m = padded.slice(-2);
  const t = `${h}:${m}`;
  if (!TIME_RE.test(t)) return null;
  const [hh, mm] = t.split(':');
  return `${hh.padStart(2, '0')}:${mm}`;
}

/** Normalize HH:MM (24h) for dashboard time fields, or null if invalid. */
export function normalizeHmInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const colonPartial = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonPartial) {
    const h = parseInt(colonPartial[1]!, 10);
    if (h > 23) return null;
    const mPart = colonPartial[2]!;
    const mm =
      mPart.length === 1 ? parseInt(`${mPart}0`, 10) : parseInt(mPart, 10);
    if (mm > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  if (/^\d{1,4}$/.test(s)) {
    return normalizeHmFromDigits(s);
  }

  const t = s.slice(0, 5);
  if (!TIME_RE.test(t)) return null;
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

/** Parse a non-negative integer; strips leading zeros (e.g. "02" → 2). */
export function parseNonNegativeInt(
  raw: string,
  opts?: { min?: number; max?: number; empty?: number },
): number {
  const digits = raw.trim().replace(/\D/g, '');
  if (digits === '') {
    return opts?.empty ?? opts?.min ?? 0;
  }
  let n = parseInt(digits, 10);
  if (!Number.isFinite(n)) {
    return opts?.empty ?? opts?.min ?? 0;
  }
  if (opts?.min != null) n = Math.max(opts.min, n);
  if (opts?.max != null) n = Math.min(opts.max, n);
  return n;
}

/** Map locale-specific decimal separators before stripping (mobile PT/EU comma, zh fullwidth). */
function unifyDecimalSeparators(raw: string): string {
  return raw
    .replace(/[，。．]/g, '.')
    .replace(/,/g, '.');
}

/** Decimal text input without leading zeros on the integer part (e.g. "05.5" → "5.5"). */
export function normalizeDecimalInput(raw: string): string {
  const cleaned = unifyDecimalSeparators(raw).replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const hasDot = cleaned.includes('.');
  const [intRaw = '', ...decimalParts] = cleaned.split('.');
  const decimalRaw = decimalParts.join('').slice(0, 2);

  let normalizedInt = intRaw || '0';
  if (normalizedInt.length > 1) {
    normalizedInt = normalizedInt.replace(/^0+/, '');
    if (!normalizedInt) normalizedInt = '0';
  }

  if (!hasDot) return normalizedInt;
  return `${normalizedInt}.${decimalRaw}`;
}

export function parseDecimalInput(raw: string, opts?: { min?: number; max?: number }): number {
  const normalized = normalizeDecimalInput(raw);
  if (normalized === '') return opts?.min ?? 0;
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return opts?.min ?? 0;
  let v = n;
  if (opts?.min != null) v = Math.max(opts.min, v);
  if (opts?.max != null) v = Math.min(opts.max, v);
  return v;
}

/** Display a number in a decimal input (no spurious leading zeros). */
export function formatDecimalInputValue(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(n);
}
