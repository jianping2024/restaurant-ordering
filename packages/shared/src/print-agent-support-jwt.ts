import { signHmacJwt, verifyHmacJwt } from './hmac-jwt';

export const PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC = 15 * 60;

export type PrintAgentSupportJwtClaims = {
  typ: 'print_agent_support';
  jti: string;
  restaurant_id: string;
  device_id: string;
  actor_user_id: string;
  iat: number;
  exp: number;
};

export function signPrintAgentSupportJwt(
  claims: Omit<PrintAgentSupportJwtClaims, 'iat' | 'exp' | 'typ'>,
  secret: string,
  expiresInSec = PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC,
): string {
  const now = Math.floor(Date.now() / 1000);
  return signHmacJwt<PrintAgentSupportJwtClaims>(
    {
      typ: 'print_agent_support',
      jti: claims.jti,
      restaurant_id: claims.restaurant_id,
      device_id: claims.device_id,
      actor_user_id: claims.actor_user_id,
      iat: now,
      exp: now + expiresInSec,
    },
    secret,
  );
}

export function verifyPrintAgentSupportJwt(
  token: string,
  secret: string,
): PrintAgentSupportJwtClaims | null {
  const payload = verifyHmacJwt<PrintAgentSupportJwtClaims>(token, secret);
  if (!payload || payload.typ !== 'print_agent_support') return null;
  if (!payload.jti || !payload.restaurant_id || !payload.device_id || !payload.actor_user_id) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}
