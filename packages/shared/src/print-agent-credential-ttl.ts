export const PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT = 365;
export const PRINT_AGENT_CREDENTIAL_TTL_DAYS_MAX = 365;
export const PRINT_AGENT_CREDENTIAL_TTL_DAYS_MIN = 1;

export function clampPrintAgentCredentialTtlDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT;
  }
  return Math.min(
    PRINT_AGENT_CREDENTIAL_TTL_DAYS_MAX,
    Math.max(PRINT_AGENT_CREDENTIAL_TTL_DAYS_MIN, Math.round(value)),
  );
}

export function resolvePrintAgentCredentialTtlDays(rawConfig: unknown): number {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT;
  }
  return clampPrintAgentCredentialTtlDays(
    (rawConfig as Record<string, unknown>).credential_ttl_days,
  );
}

export function printAgentCredentialTtlSec(days: number): number {
  return clampPrintAgentCredentialTtlDays(days) * 24 * 60 * 60;
}

export function resolvePrintAgentCredentialTtlSec(rawConfig: unknown): number {
  return printAgentCredentialTtlSec(resolvePrintAgentCredentialTtlDays(rawConfig));
}

export function parsePrintAgentCredentialTtlDaysPatch(body: unknown): number | null | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  if (!('credentialTtlDays' in (body as Record<string, unknown>))) return undefined;
  const raw = (body as Record<string, unknown>).credentialTtlDays;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return clampPrintAgentCredentialTtlDays(raw);
}
