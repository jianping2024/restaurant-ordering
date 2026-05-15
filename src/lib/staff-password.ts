import bcrypt from 'bcryptjs';
import type { StaffRole } from '@/lib/staff-session';

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;
const SALT_ROUNDS = 10;

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isStaffPinHash(stored: string): boolean {
  return BCRYPT_HASH_RE.test(stored);
}

export function hashStaffPin(pin: string): string {
  return bcrypt.hashSync(pin, SALT_ROUNDS);
}

/** Verify 4-digit PIN against bcrypt hash or legacy plaintext (constant-time). */
export function verifyStaffPin(stored: string, pin: string): boolean {
  if (isStaffPinHash(stored)) {
    return bcrypt.compareSync(pin, stored);
  }
  return timingSafeEqualStrings(pin, stored);
}

/** Kitchen: kitchen PIN only. Waiter: waiter or kitchen PIN (shared tablet). */
export function verifyStaffLoginPassword(
  restaurant: { waiter_password: string; kitchen_password: string },
  role: StaffRole,
  password: string,
): boolean {
  if (role === 'kitchen') {
    return verifyStaffPin(restaurant.kitchen_password, password);
  }
  return (
    verifyStaffPin(restaurant.waiter_password, password) ||
    verifyStaffPin(restaurant.kitchen_password, password)
  );
}

/** After successful login, upgrade any matched legacy plaintext columns to bcrypt. */
export function legacyStaffPasswordUpgrades(
  restaurant: { waiter_password: string; kitchen_password: string },
  password: string,
): Partial<{ kitchen_password: string; waiter_password: string }> {
  const updates: Partial<{ kitchen_password: string; waiter_password: string }> = {};
  if (
    !isStaffPinHash(restaurant.kitchen_password) &&
    verifyStaffPin(restaurant.kitchen_password, password)
  ) {
    updates.kitchen_password = hashStaffPin(password);
  }
  if (
    !isStaffPinHash(restaurant.waiter_password) &&
    verifyStaffPin(restaurant.waiter_password, password)
  ) {
    updates.waiter_password = hashStaffPin(password);
  }
  return updates;
}
