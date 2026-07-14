import {
  PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT,
  resolvePrintAgentCredentialTtlDays,
} from '@mesa/shared';

export type TimeWindow = { start: string; end: string };

export type PrintAgentScheduleConfig = {
  timezone?: string;
  weekday?: { windows: TimeWindow[] };
  saturday?: { windows: TimeWindow[] };
  sunday?: { windows: TimeWindow[] };
};

export type PrintAgentPollConfig = {
  idle_interval_sec?: number;
  busy_interval_sec?: number;
  after_print_interval_sec?: number;
  warm_interval_sec?: number;
  warm_after_activity_sec?: number;
  closed_check_sec?: number;
  error_interval_sec?: number;
};

export type PrintAgentCloudConfig = {
  schedule?: PrintAgentScheduleConfig;
  poll?: PrintAgentPollConfig;
  /** Agent JWT lifetime in days after claim; default 365, max 365. */
  credential_ttl_days?: number;
  /** `station:{uuid}` used for bill/pre_bill/checkout receipts when the client omits a printer. */
  default_receipt_station_id?: string;
  /** When true, station tickets print centered top-level category group headers. Default false. */
  station_slip_show_category_group?: boolean;
};

/** Flat form used on the dashboard settings page. */
export type PrintAgentSettingsForm = {
  timezone: string;
  lunchStart: string;
  lunchEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
  afterPrintIntervalSec: number;
  warmIntervalSec: number;
  idleIntervalSec: number;
  warmAfterActivitySec: number;
  closedCheckSec: number;
};

type PollLimit = { min: number; max: number; default: number };

/** Single source for dashboard poll interval bounds (seconds). */
export const PRINT_AGENT_POLL_LIMITS = {
  afterPrintIntervalSec: { min: 8, max: 60, default: 8 },
  warmIntervalSec: { min: 15, max: 60, default: 15 },
  warmAfterActivitySec: { min: 600, max: 7200, default: 1800 },
  idleIntervalSec: { min: 20, max: 120, default: 20 },
  closedCheckSec: { min: 15, max: 300, default: 60 },
} as const satisfies Record<string, PollLimit>;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function clampPollSec(n: number | undefined, limits: PollLimit): number {
  if (!Number.isFinite(n)) return limits.default;
  return Math.min(limits.max, Math.max(limits.min, Math.round(n!)));
}

/** Enforce poll interval bounds for storage, display, and agent runtime-config. */
export function sanitizePollConfig(poll: PrintAgentPollConfig | undefined): PrintAgentPollConfig {
  const L = PRINT_AGENT_POLL_LIMITS;
  const p = poll ?? {};
  return {
    idle_interval_sec: clampPollSec(p.idle_interval_sec, L.idleIntervalSec),
    busy_interval_sec: 5,
    after_print_interval_sec: clampPollSec(p.after_print_interval_sec, L.afterPrintIntervalSec),
    warm_interval_sec: clampPollSec(p.warm_interval_sec, L.warmIntervalSec),
    warm_after_activity_sec: clampPollSec(p.warm_after_activity_sec, L.warmAfterActivitySec),
    closed_check_sec: clampPollSec(p.closed_check_sec, L.closedCheckSec),
    error_interval_sec: 5,
  };
}

export function defaultPrintAgentCloudConfig(): PrintAgentCloudConfig {
  return {
    credential_ttl_days: PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT,
    schedule: {
      timezone: 'Europe/Lisbon',
      weekday: {
        windows: [
          { start: '12:00', end: '15:00' },
          { start: '19:30', end: '23:00' },
        ],
      },
    },
    poll: sanitizePollConfig({}),
  };
}

function parseTime(s: string): string | null {
  const t = s.trim().slice(0, 5);
  if (!TIME_RE.test(t)) return null;
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

export function cloudConfigToForm(raw: unknown): PrintAgentSettingsForm {
  const d = defaultPrintAgentCloudConfig();
  const c = normalizePrintAgentCloudConfig(raw);
  const wins = c.schedule?.weekday?.windows ?? d.schedule!.weekday!.windows;
  const lunch = wins[0] ?? { start: '12:00', end: '15:00' };
  const dinner = wins[1] ?? { start: '19:30', end: '23:00' };
  const poll = c.poll!;
  return {
    timezone: c.schedule?.timezone ?? d.schedule!.timezone ?? 'Europe/Lisbon',
    lunchStart: lunch.start,
    lunchEnd: lunch.end,
    dinnerStart: dinner.start,
    dinnerEnd: dinner.end,
    afterPrintIntervalSec: poll.after_print_interval_sec!,
    warmIntervalSec: poll.warm_interval_sec!,
    idleIntervalSec: poll.idle_interval_sec!,
    warmAfterActivitySec: poll.warm_after_activity_sec!,
    closedCheckSec: poll.closed_check_sec!,
  };
}

export function formToCloudConfig(form: PrintAgentSettingsForm): PrintAgentCloudConfig {
  const lunchStart = parseTime(form.lunchStart);
  const lunchEnd = parseTime(form.lunchEnd);
  const dinnerStart = parseTime(form.dinnerStart);
  const dinnerEnd = parseTime(form.dinnerEnd);
  if (!lunchStart || !lunchEnd || !dinnerStart || !dinnerEnd) {
    throw new Error('invalid_time');
  }
  if (lunchEnd <= lunchStart || dinnerEnd <= dinnerStart) {
    throw new Error('end_before_start');
  }
  const tz = form.timezone.trim() || 'Europe/Lisbon';
  return {
    schedule: {
      timezone: tz,
      weekday: {
        windows: [
          { start: lunchStart, end: lunchEnd },
          { start: dinnerStart, end: dinnerEnd },
        ],
      },
    },
    poll: sanitizePollConfig({
      idle_interval_sec: form.idleIntervalSec,
      after_print_interval_sec: form.afterPrintIntervalSec,
      warm_interval_sec: form.warmIntervalSec,
      warm_after_activity_sec: form.warmAfterActivitySec,
      closed_check_sec: form.closedCheckSec,
    }),
  };
}

export function parseDefaultReceiptStationId(raw: unknown): string | undefined {
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id.startsWith('station:')) return undefined;
  const stationUuid = id.slice('station:'.length);
  if (!/^[0-9a-f-]{36}$/i.test(stationUuid)) return undefined;
  return id;
}

export function normalizePrintAgentCloudConfig(raw: unknown): PrintAgentCloudConfig {
  if (!raw || typeof raw !== 'object') return defaultPrintAgentCloudConfig();
  const o = raw as Record<string, unknown>;
  const base = defaultPrintAgentCloudConfig();
  const schedule =
    o.schedule && typeof o.schedule === 'object'
      ? (o.schedule as PrintAgentScheduleConfig)
      : base.schedule;
  const poll =
    o.poll && typeof o.poll === 'object'
      ? sanitizePollConfig(o.poll as PrintAgentPollConfig)
      : base.poll;
  const default_receipt_station_id = parseDefaultReceiptStationId(o.default_receipt_station_id);
  const station_slip_show_category_group =
    o.station_slip_show_category_group === true ? true : undefined;
  return {
    schedule,
    poll,
    credential_ttl_days: resolvePrintAgentCredentialTtlDays(o),
    ...(default_receipt_station_id ? { default_receipt_station_id } : {}),
    ...(station_slip_show_category_group ? { station_slip_show_category_group: true } : {}),
  };
}

/** Guest-order / station slip: print `(Bebidas/ Drinks2)` group headers between item blocks. */
export function isStationSlipShowCategoryGroupEnabled(raw: unknown): boolean {
  return normalizePrintAgentCloudConfig(raw).station_slip_show_category_group === true;
}

export function parseStationSlipShowCategoryGroupPatch(
  body: unknown,
): boolean | undefined | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const raw = (body as Record<string, unknown>).stationSlipShowCategoryGroup;
  if (raw === undefined) return undefined;
  if (typeof raw !== 'boolean') return null;
  return raw;
}

export function validatePrintAgentCloudConfig(raw: unknown): { ok: true; config: PrintAgentCloudConfig } | { ok: false; error: string } {
  try {
    const c = normalizePrintAgentCloudConfig(raw);
    const form = cloudConfigToForm(c);
    const out = formToCloudConfig(form);
    return {
      ok: true,
      config: {
        ...out,
        credential_ttl_days: c.credential_ttl_days,
        ...(c.default_receipt_station_id
          ? { default_receipt_station_id: c.default_receipt_station_id }
          : {}),
        ...(c.station_slip_show_category_group
          ? { station_slip_show_category_group: true }
          : {}),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'invalid_config' };
  }
}
