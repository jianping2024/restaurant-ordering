import { signHmacJwt, verifyHmacJwt } from './hmac-jwt';

export type PrintAgentJwtClaims = {
  typ: 'print_agent';
  restaurant_id: string;
  device_id: string;
  iat: number;
  exp: number;
};

export function signPrintAgentJwt(
  claims: Omit<PrintAgentJwtClaims, 'iat' | 'exp' | 'typ'>,
  secret: string,
  expiresInSec: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  return signHmacJwt<PrintAgentJwtClaims>(
    {
      typ: 'print_agent',
      restaurant_id: claims.restaurant_id,
      device_id: claims.device_id,
      iat: now,
      exp: now + expiresInSec,
    },
    secret,
  );
}

export function verifyPrintAgentJwt(token: string, secret: string): PrintAgentJwtClaims | null {
  const payload = verifyHmacJwt<PrintAgentJwtClaims>(token, secret);
  if (!payload || payload.typ !== 'print_agent') return null;
  if (!payload.restaurant_id || !payload.device_id) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}
