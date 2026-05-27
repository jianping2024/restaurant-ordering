/** Formats ms until expiry as M:SS for pairing code UI. */
export function formatPairingCountdown(remainingMs: number): string {
  if (remainingMs <= 0) {
    return '0:00';
  }
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function pairingExpiryRemainingMs(expiresAtIso: string, nowMs = Date.now()): number {
  return new Date(expiresAtIso).getTime() - nowMs;
}
