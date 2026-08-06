import { randomInt } from 'crypto';

const WEAK_CODES = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '012345',
  '543210',
]);

export function randomPairingCode(): string {
  for (let i = 0; i < 64; i += 1) {
    const n = randomInt(0, 1_000_000);
    const code = String(n).padStart(6, '0');
    if (!WEAK_CODES.has(code)) return code;
  }
  return String(randomInt(100000, 1_000_000)).padStart(6, '0');
}

/**
 * List display for a pairing row: full 6-digit when still pending;
 * masked when already consumed (or malformed).
 */
export function pairingListCode(code: string, consumed: boolean): string {
  if (consumed || code.length !== 6) return '******';
  return code;
}
