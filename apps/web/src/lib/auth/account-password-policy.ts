/**
 * Sole account password policy (staff + owner set-password paths).
 * Min 8; letter+digit; deny common weak; not equal to login name when provided.
 * No special-character composition requirement.
 */

export const ACCOUNT_PASSWORD_MIN_LENGTH = 8;

export type AccountPasswordPolicyError =
  | 'password_short'
  | 'password_need_letter_digit'
  | 'password_weak'
  | 'password_matches_login';

/** Lowercased denylist — common / trivial passwords of length ≥ min. */
const WEAK_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password12',
  'password123',
  'qwerty12',
  'qwerty123',
  'abc12345',
  'abcdefgh',
  '11111111',
  '00000000',
  '87654321',
  'passw0rd',
  'iloveyou',
  'admin123',
  'welcome1',
  'monkey12',
  'letmein1',
  'mesa1234',
  'mesago12',
]);

export function accountPasswordPolicyError(
  password: string,
  options?: { loginName?: string | null },
): AccountPasswordPolicyError | null {
  if (typeof password !== 'string' || password.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
    return 'password_short';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'password_need_letter_digit';
  }
  const lower = password.toLowerCase();
  if (WEAK_PASSWORDS.has(lower)) {
    return 'password_weak';
  }
  const login = options?.loginName?.trim().toLowerCase();
  if (login && lower === login) {
    return 'password_matches_login';
  }
  return null;
}

export function accountPasswordValid(
  password: string,
  options?: { loginName?: string | null },
): boolean {
  return accountPasswordPolicyError(password, options) === null;
}

/** Staff post-login: metadata flag or plaintext fails policy → change-password. */
export function staffLoginRequiresPasswordChange(params: {
  mustChangePasswordFlag: boolean;
  password: string;
  loginName?: string | null;
}): boolean {
  return (
    params.mustChangePasswordFlag ||
    accountPasswordPolicyError(params.password, {
      loginName: params.loginName,
    }) !== null
  );
}
