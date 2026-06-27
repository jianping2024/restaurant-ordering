/** Device considered offline when last_seen is older than this (≈2× typical idle poll). */
export const PRINT_AGENT_HEARTBEAT_OFFLINE_MS = 2 * 60 * 1000;

export type PrintAgentDeviceHeartbeatRow = {
  id: string;
  label: string | null;
  valid_until: string;
  revoked_at?: string | null;
  last_seen: string | null;
  agent_version?: string | null;
  mapped_station_count?: number | null;
  mapped_station_labels?: string[];
  last_print_at?: string | null;
  last_print_status?: string | null;
  schedule_open?: boolean | null;
};

export function isPrintAgentDeviceOnline(
  lastSeen: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastSeen) return false;
  const ms = new Date(lastSeen).getTime();
  if (Number.isNaN(ms)) return false;
  return now - ms <= PRINT_AGENT_HEARTBEAT_OFFLINE_MS;
}

export function formatLastSeenRelative(
  lastSeen: string | null | undefined,
  locale: string,
  now = Date.now(),
): string {
  if (!lastSeen) return '—';
  const ms = new Date(lastSeen).getTime();
  if (Number.isNaN(ms)) return '—';
  const diffSec = Math.round((now - ms) / 1000);
  if (diffSec < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffSec, 'second');
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 120) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffMin, 'minute');
  }
  return new Date(lastSeen).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
