/** Device offline when last_seen older than this (≈2× 5-minute agent heartbeat). */
export const PRINT_AGENT_HEARTBEAT_OFFLINE_MS = 10 * 60 * 1000;

export type PrintAgentNotificationMode = 'realtime' | 'polling';

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
  notification_mode?: PrintAgentNotificationMode | null;
};

export function parsePrintAgentNotificationMode(
  value: unknown,
): PrintAgentNotificationMode | null {
  if (value === 'realtime' || value === 'polling') return value;
  return null;
}

/**
 * Restaurant-level mode for staff surfaces: any online polling wins (warning-first);
 * else realtime if any online device reports it; else null (offline / unknown).
 */
export function resolveRestaurantPrintNotifyMode(
  devices: readonly PrintAgentDeviceHeartbeatRow[],
  now = Date.now(),
): PrintAgentNotificationMode | null {
  const online = devices.filter((d) => isPrintAgentDeviceOnline(d.last_seen, now));
  if (online.length === 0) return null;
  if (online.some((d) => d.notification_mode === 'polling')) return 'polling';
  if (online.some((d) => d.notification_mode === 'realtime')) return 'realtime';
  return null;
}

/** Shared tone for realtime (neutral) vs polling (strong warning). */
export function printNotifyModeClass(mode: PrintAgentNotificationMode | null): string {
  if (mode === 'polling') {
    return 'rounded px-1.5 py-0.5 font-semibold text-status-danger bg-[rgb(var(--color-status-danger-border)/0.14)]';
  }
  if (mode === 'realtime') {
    return 'text-brand-ink';
  }
  return 'text-brand-muted';
}

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
