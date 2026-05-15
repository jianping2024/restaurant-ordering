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

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function defaultPrintAgentCloudConfig(): PrintAgentCloudConfig {
  return {
    schedule: {
      timezone: 'Europe/Lisbon',
      weekday: {
        windows: [
          { start: '12:00', end: '15:00' },
          { start: '19:30', end: '23:00' },
        ],
      },
    },
    poll: {
      idle_interval_sec: 10,
      busy_interval_sec: 5,
      after_print_interval_sec: 5,
      warm_interval_sec: 5,
      warm_after_activity_sec: 1800,
      closed_check_sec: 60,
      error_interval_sec: 5,
    },
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
  const poll = { ...d.poll, ...c.poll };
  return {
    timezone: c.schedule?.timezone ?? d.schedule!.timezone ?? 'Europe/Lisbon',
    lunchStart: lunch.start,
    lunchEnd: lunch.end,
    dinnerStart: dinner.start,
    dinnerEnd: dinner.end,
    afterPrintIntervalSec: poll.after_print_interval_sec ?? 5,
    warmIntervalSec: poll.warm_interval_sec ?? 5,
    idleIntervalSec: poll.idle_interval_sec ?? 10,
    warmAfterActivitySec: poll.warm_after_activity_sec ?? 1800,
    closedCheckSec: poll.closed_check_sec ?? 60,
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
    poll: {
      idle_interval_sec: clampSec(form.idleIntervalSec, 3, 120, 10),
      busy_interval_sec: 5,
      after_print_interval_sec: clampSec(form.afterPrintIntervalSec, 0, 60, 5),
      warm_interval_sec: clampSec(form.warmIntervalSec, 2, 60, 5),
      warm_after_activity_sec: clampSec(form.warmAfterActivitySec, 60, 7200, 1800),
      closed_check_sec: clampSec(form.closedCheckSec, 15, 300, 60),
      error_interval_sec: 5,
    },
  };
}

function clampSec(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
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
    o.poll && typeof o.poll === 'object' ? (o.poll as PrintAgentPollConfig) : base.poll;
  return { schedule, poll };
}

export function validatePrintAgentCloudConfig(raw: unknown): { ok: true; config: PrintAgentCloudConfig } | { ok: false; error: string } {
  try {
    const c = normalizePrintAgentCloudConfig(raw);
    const form = cloudConfigToForm(c);
    const out = formToCloudConfig(form);
    return { ok: true, config: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'invalid_config' };
  }
}
