/** Device considered offline when last_seen is older than this (≈2× typical idle poll). */
export const PRINT_AGENT_HEARTBEAT_OFFLINE_MS = 2 * 60 * 1000;

export function isPrintAgentDeviceOnline(
  lastSeen: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastSeen) return false;
  const ms = new Date(lastSeen).getTime();
  if (Number.isNaN(ms)) return false;
  return now - ms <= PRINT_AGENT_HEARTBEAT_OFFLINE_MS;
}

export function isPrintAgentDeviceActive(
  revokedAt: string | null | undefined,
  validUntil: string | null | undefined,
  now = Date.now(),
): boolean {
  if (revokedAt) return false;
  if (!validUntil) return false;
  const ms = new Date(validUntil).getTime();
  if (Number.isNaN(ms)) return false;
  return ms > now;
}
