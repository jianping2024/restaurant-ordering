export type Rational = { readonly num: number; readonly den: number };

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function normalizeRational({ num, den }: Rational): Rational {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return { num: 0, den: 1 };
  }
  const sign = num < 0 !== den < 0 ? -1 : 1;
  const absNum = Math.abs(num);
  const absDen = Math.abs(den);
  const g = gcd(absNum, absDen);
  return { num: sign * (absNum / g), den: absDen / g };
}

export function rationalFromInt(n: number): Rational {
  if (!Number.isFinite(n)) return { num: 0, den: 1 };
  return normalizeRational({ num: Math.round(n), den: 1 });
}

export function rationalFromNumber(n: number): Rational {
  if (!Number.isFinite(n)) return { num: 0, den: 1 };
  if (Number.isInteger(n)) return rationalFromInt(n);
  return normalizeRational({ num: Math.round(n * 10_000), den: 10_000 });
}

/** Parse "2", "1/3", "2 1/3", or simple decimals like "2.5". */
export function parseQtyInput(raw: string): Rational | null {
  const s = raw.trim();
  if (!s) return null;

  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (!Number.isFinite(whole) || !Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
      return null;
    }
    return normalizeRational({ num: whole * den + num, den });
  }

  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
    return normalizeRational({ num, den });
  }

  const integer = /^(\d+)$/.exec(s);
  if (integer) return rationalFromInt(Number(integer[1]));

  const decimal = /^(\d+(?:\.\d+)?)$/.exec(s);
  if (decimal) {
    const value = Number(decimal[1]);
    if (!Number.isFinite(value) || value < 0) return null;
    return rationalFromNumber(value);
  }

  return null;
}

export function addRationals(a: Rational, b: Rational): Rational {
  return normalizeRational({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
}

export function sumRationals(values: Rational[]): Rational {
  return values.reduce((acc, value) => addRationals(acc, value), { num: 0, den: 1 });
}

export function rationalsEqual(a: Rational, b: Rational): boolean {
  const left = normalizeRational(a);
  const right = normalizeRational(b);
  return left.num === right.num && left.den === right.den;
}

export function compareRationals(a: Rational, b: Rational): -1 | 0 | 1 {
  const diff = normalizeRational({
    num: a.num * b.den - b.num * a.den,
    den: a.den * b.den,
  });
  if (diff.num === 0) return 0;
  return diff.num < 0 ? -1 : 1;
}

export function rationalGte(a: Rational, b: Rational): boolean {
  return compareRationals(a, b) >= 0;
}

export function rationalToNumber(value: Rational): number {
  const normalized = normalizeRational(value);
  return normalized.num / normalized.den;
}

export function formatRational(value: Rational): string {
  const { num, den } = normalizeRational(value);
  if (den === 1) return String(num);
  const sign = num < 0 ? -1 : 1;
  const absNum = Math.abs(num);
  const whole = Math.floor(absNum / den);
  const rem = absNum % den;
  const signPrefix = sign < 0 ? '-' : '';
  if (whole > 0 && rem > 0) return `${signPrefix}${whole} ${rem}/${den}`;
  if (whole > 0) return `${signPrefix}${whole}`;
  return `${signPrefix}${absNum}/${den}`;
}

export function compareRationalSumToTarget(shares: Rational[], targetQty: number): -1 | 0 | 1 {
  const target = rationalFromNumber(targetQty);
  const sum = sumRationals(shares);
  const diff = normalizeRational({ num: sum.num * target.den - target.num * sum.den, den: sum.den * target.den });
  if (diff.num === 0) return 0;
  return diff.num < 0 ? -1 : 1;
}
