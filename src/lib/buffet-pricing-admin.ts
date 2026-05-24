import type { BuffetCalendarKind, BuffetPriceRule } from '@/types';

const LISBON_TZ = 'Europe/Lisbon';

export type CalendarOverrideRow = { on_date: string; kind: 'holiday' | 'special' };

/** Mirrors resolve_buffet_prices day-kind logic (Lisbon calendar date). */
export function getDayKindForDate(
  dateIso: string,
  overrides: CalendarOverrideRow[],
): BuffetCalendarKind {
  const d = dateIso.slice(0, 10);
  const ov = overrides.find((r) => r.on_date.slice(0, 10) === d);
  if (ov?.kind === 'holiday') return 'holiday';
  if (ov?.kind === 'special') return 'special';
  const dow = new Date(`${d}T12:00:00`).getDay();
  if (dow === 0 || dow === 6) return 'weekend';
  return 'weekday';
}

export function ruleCoversDate(rule: BuffetPriceRule, dateIso: string): boolean {
  if (!rule.is_active) return false;
  const d = dateIso.slice(0, 10);
  const from = rule.valid_from?.slice(0, 10) ?? '';
  const to = rule.valid_to?.slice(0, 10) ?? '';
  return d >= from && d <= to;
}

export function hasActiveRuleForDayKind(
  rules: BuffetPriceRule[],
  opts: {
    buffetId: string;
    calendarKind: BuffetCalendarKind;
    dateIso: string;
    timeSlotId?: string;
  },
): boolean {
  return rules.some(
    (r) =>
      r.buffet_id === opts.buffetId &&
      r.calendar_kind === opts.calendarKind &&
      ruleCoversDate(r, opts.dateIso) &&
      (!opts.timeSlotId || r.time_slot_id === opts.timeSlotId),
  );
}

export function datesInRangeInclusive(from: string, to: string): string[] {
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  if (!start || !end || end < start) return [];
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function rangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function findOverlappingRules(
  rules: BuffetPriceRule[],
  draft: {
    buffet_id: string;
    time_slot_id: string;
    calendar_kind: BuffetCalendarKind;
    valid_from: string;
    valid_to: string;
    excludeId?: string;
  },
): BuffetPriceRule[] {
  return rules.filter(
    (r) =>
      r.is_active &&
      r.id !== draft.excludeId &&
      r.buffet_id === draft.buffet_id &&
      r.time_slot_id === draft.time_slot_id &&
      r.calendar_kind === draft.calendar_kind &&
      rangesOverlap(
        draft.valid_from.slice(0, 10),
        draft.valid_to.slice(0, 10),
        r.valid_from?.slice(0, 10) ?? '',
        r.valid_to?.slice(0, 10) ?? '',
      ),
  );
}

export type RuleStatusFilter = 'all' | 'active' | 'upcoming' | 'expired';

export function getRuleStatus(rule: BuffetPriceRule, todayIso: string): RuleStatusFilter {
  const t = todayIso.slice(0, 10);
  const from = rule.valid_from?.slice(0, 10) ?? '';
  const to = rule.valid_to?.slice(0, 10) ?? '';
  if (!rule.is_active) return 'expired';
  if (to < t) return 'expired';
  if (from > t) return 'upcoming';
  return 'active';
}

/** Wall clock in Europe/Lisbon → UTC ISO string for resolve_buffet_prices. */
export function lisbonWallTimeToUtcIso(date: string, time: string): string {
  const d = date.slice(0, 10);
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10) || 0);
  const guess = new Date(`${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LISBON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const read = (utc: Date) => {
    const parts = fmt.formatToParts(utc);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
      y: parseInt(get('year'), 10),
      mo: parseInt(get('month'), 10),
      day: parseInt(get('day'), 10),
      h: parseInt(get('hour'), 10),
      m: parseInt(get('minute'), 10),
    };
  };
  const targetY = parseInt(d.slice(0, 4), 10);
  const targetMo = parseInt(d.slice(5, 7), 10);
  const targetDay = parseInt(d.slice(8, 10), 10);

  let low = guess.getTime() - 3 * 60 * 60 * 1000;
  let high = guess.getTime() + 3 * 60 * 60 * 1000;
  for (let i = 0; i < 24; i++) {
    const mid = Math.floor((low + high) / 2);
    const p = read(new Date(mid));
    const cmp =
      p.y !== targetY
        ? p.y - targetY
        : p.mo !== targetMo
          ? p.mo - targetMo
          : p.day !== targetDay
            ? p.day - targetDay
            : p.h !== hh
              ? p.h - hh
              : p.m - mm;
    if (cmp === 0) return new Date(mid).toISOString();
    if (cmp < 0) low = mid + 1;
    else high = mid - 1;
  }
  return new Date(guess).toISOString();
}

export function todayIsoLocal(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowTimeHmLocal(): string {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

export const CALENDAR_KINDS: BuffetCalendarKind[] = ['weekday', 'weekend', 'holiday', 'special'];
