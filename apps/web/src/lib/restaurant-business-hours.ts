/**
 * Guest-facing restaurant weekly hours (sole shape).
 * Not print_agent_config.schedule.
 */

export const RESTAURANT_BUSINESS_HOURS_TIMEZONE_DEFAULT = 'Europe/Lisbon';

export type RestaurantHoursWindow = { open: string; close: string };

export type RestaurantWeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '7';

/** weekday 1=Mon … 7=Sun (ISO). */
export type RestaurantBusinessHours = {
  timezone: string;
  week: Partial<Record<RestaurantWeekdayKey, RestaurantHoursWindow[]>>;
};

/** Seed when turning a closed day on (settings editor). */
export const DEFAULT_RESTAURANT_DAY_WINDOW: RestaurantHoursWindow = {
  open: '12:00',
  close: '22:00',
};

/** Seed for an added second segment (e.g. dinner after lunch). */
export const DEFAULT_RESTAURANT_EXTRA_WINDOW: RestaurantHoursWindow = {
  open: '19:00',
  close: '23:00',
};

export const RESTAURANT_WEEKDAY_KEYS: RestaurantWeekdayKey[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
];

export const RESTAURANT_WEEKDAY_KEYS_MON_FRI: RestaurantWeekdayKey[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
];

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function emptyRestaurantBusinessHours(): RestaurantBusinessHours {
  return { timezone: RESTAURANT_BUSINESS_HOURS_TIMEZONE_DEFAULT, week: {} };
}

function parseTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, 5);
  if (!TIME_RE.test(t)) return null;
  const [h, m] = t.split(':');
  return `${h!.padStart(2, '0')}:${m}`;
}

function parseWindows(value: unknown): RestaurantHoursWindow[] {
  if (!Array.isArray(value)) return [];
  const out: RestaurantHoursWindow[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const open = parseTime((row as { open?: unknown }).open);
    const close = parseTime((row as { close?: unknown }).close);
    if (!open || !close || open === close) continue;
    out.push({ open, close });
  }
  return out;
}

/** Normalize DB / API payload. */
export function normalizeRestaurantBusinessHours(value: unknown): RestaurantBusinessHours {
  const empty = emptyRestaurantBusinessHours();
  if (!value || typeof value !== 'object') return empty;
  const row = value as Record<string, unknown>;
  const tz =
    typeof row.timezone === 'string' && row.timezone.trim()
      ? row.timezone.trim()
      : empty.timezone;
  const weekRaw =
    row.week && typeof row.week === 'object' ? (row.week as Record<string, unknown>) : row;
  const week: RestaurantBusinessHours['week'] = {};
  for (const key of ['1', '2', '3', '4', '5', '6', '7'] as const) {
    const windows = parseWindows(weekRaw[key]);
    if (windows.length) week[key] = windows;
  }
  return { timezone: tz, week };
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

/** Lisbon (or configured TZ) wall-clock parts for "now". */
export function restaurantLocalNowParts(
  now: Date,
  timeZone: string = RESTAURANT_BUSINESS_HOURS_TIMEZONE_DEFAULT,
): { weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const wd = parts.weekday ?? 'Mon';
  const map: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const weekday = map[wd] ?? 1;
  const hour = Number(parts.hour ?? '0');
  const minute = Number(parts.minute ?? '0');
  return { weekday, minutes: hour * 60 + minute };
}

function windowContains(minutes: number, open: string, close: string): boolean {
  const a = minutesOfDay(open);
  const b = minutesOfDay(close);
  if (a < b) return minutes >= a && minutes < b;
  // Overnight: open >= close means through midnight
  return minutes >= a || minutes < b;
}

export function isRestaurantOpenNow(
  hours: RestaurantBusinessHours,
  now: Date = new Date(),
): boolean {
  const { weekday, minutes } = restaurantLocalNowParts(now, hours.timezone);
  const windows = hours.week[String(weekday) as keyof typeof hours.week] ?? [];
  return windows.some((w) => windowContains(minutes, w.open, w.close));
}

/** End of the current open window, or null if closed. */
export function restaurantOpenUntilLabel(
  hours: RestaurantBusinessHours,
  now: Date = new Date(),
): string | null {
  const { weekday, minutes } = restaurantLocalNowParts(now, hours.timezone);
  const windows = hours.week[String(weekday) as keyof typeof hours.week] ?? [];
  for (const w of windows) {
    if (windowContains(minutes, w.open, w.close)) return w.close;
  }
  return null;
}

export function restaurantTodayWindows(
  hours: RestaurantBusinessHours,
  now: Date = new Date(),
): RestaurantHoursWindow[] {
  const { weekday } = restaurantLocalNowParts(now, hours.timezone);
  return hours.week[String(weekday) as keyof typeof hours.week] ?? [];
}

/** Windows for one weekday in the settings editor (empty = closed). */
export function restaurantDayWindows(
  hours: RestaurantBusinessHours,
  day: RestaurantWeekdayKey,
): RestaurantHoursWindow[] {
  return hours.week[day] ?? [];
}

/**
 * Sole writer for one weekday’s windows in the settings draft.
 * Empty list → day closed. Incomplete HH:mm rows are kept for typing; API normalize drops them on save.
 */
export function setRestaurantDayWindows(
  hours: RestaurantBusinessHours,
  day: RestaurantWeekdayKey,
  windows: RestaurantHoursWindow[],
): RestaurantBusinessHours {
  const week = { ...hours.week };
  if (!windows.length) {
    delete week[day];
  } else {
    week[day] = windows.map((w) => ({ open: w.open, close: w.close }));
  }
  return { ...hours, week };
}

/** Copy source day’s windows onto each target day (Mon–Fri / all-week apply). */
export function applyRestaurantDayWindowsToDays(
  hours: RestaurantBusinessHours,
  sourceDay: RestaurantWeekdayKey,
  targetDays: readonly RestaurantWeekdayKey[],
): RestaurantBusinessHours {
  const windows = restaurantDayWindows(hours, sourceDay).map((w) => ({
    open: w.open,
    close: w.close,
  }));
  let next = hours;
  for (const day of targetDays) {
    next = setRestaurantDayWindows(next, day, windows);
  }
  return next;
}
