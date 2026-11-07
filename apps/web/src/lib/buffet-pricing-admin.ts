import type { Buffet, BuffetCalendarKind, BuffetPriceRule, BuffetTimeSlot } from '@/types';
import { normalizeHmInput } from '@/lib/number-input';

const LISBON_TZ = 'Europe/Lisbon';

export type CalendarOverrideRow = { on_date: string; kind: 'holiday' | 'special' };

export type DayKindOptions = {
  /** DB `time` or HH:MM — Friday at/after this uses weekend pricing. */
  fridayWeekendFrom?: string | null;
};

function hmToMinutes(hm: string): number | null {
  const normalized = normalizeHmInput(hm.slice(0, 5));
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

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

/** Date + Lisbon wall time; mirrors resolve_buffet_prices including Friday evening. */
export function getDayKindForDateTime(
  dateIso: string,
  timeHm: string,
  overrides: CalendarOverrideRow[],
  opts?: DayKindOptions,
): BuffetCalendarKind {
  const base = getDayKindForDate(dateIso, overrides);
  if (base !== 'weekday') return base;
  const from = opts?.fridayWeekendFrom;
  if (!from) return base;
  const d = dateIso.slice(0, 10);
  if (new Date(`${d}T12:00:00`).getDay() !== 5) return base;
  const fromMin = hmToMinutes(from);
  const atMin = hmToMinutes(timeHm);
  if (fromMin == null || atMin == null) return base;
  if (atMin >= fromMin) return 'weekend';
  return 'weekday';
}

/** PostgreSQL `time` → HH:MM for dashboard fields. */
export function dbTimeToHm(db: string | null | undefined): string {
  if (!db) return '';
  return normalizeHmInput(db.slice(0, 5)) ?? db.slice(0, 5);
}

/** HH:MM → PostgreSQL `time` string, or null if invalid. */
export function hmToDbTime(hm: string): string | null {
  const normalized = normalizeHmInput(hm);
  if (!normalized) return null;
  return `${normalized}:00`;
}

/** Open end for range math when `valid_to` is null/empty (long-term rule). */
export const BUFFET_RULE_OPEN_END = '9999-12-31';

export function ruleValidToOrOpen(validTo: string | null | undefined): string {
  const to = validTo?.slice(0, 10) ?? '';
  return to || BUFFET_RULE_OPEN_END;
}

export function ruleCoversDate(rule: BuffetPriceRule, dateIso: string): boolean {
  if (!rule.is_active) return false;
  const d = dateIso.slice(0, 10);
  const from = rule.valid_from?.slice(0, 10) ?? '';
  if (!from || d < from) return false;
  const to = rule.valid_to?.slice(0, 10) ?? '';
  return !to || d <= to;
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
    valid_to: string | null;
    excludeId?: string;
  },
): BuffetPriceRule[] {
  const draftFrom = draft.valid_from.slice(0, 10);
  const draftTo = ruleValidToOrOpen(draft.valid_to);
  return rules.filter(
    (r) =>
      r.is_active &&
      r.id !== draft.excludeId &&
      r.buffet_id === draft.buffet_id &&
      r.time_slot_id === draft.time_slot_id &&
      r.calendar_kind === draft.calendar_kind &&
      rangesOverlap(
        draftFrom,
        draftTo,
        r.valid_from?.slice(0, 10) ?? '',
        ruleValidToOrOpen(r.valid_to),
      ),
  );
}

export type RuleStatusFilter = 'all' | 'active' | 'upcoming' | 'expired';

export function getRuleStatus(rule: BuffetPriceRule, todayIso: string): RuleStatusFilter {
  const t = todayIso.slice(0, 10);
  const from = rule.valid_from?.slice(0, 10) ?? '';
  const to = rule.valid_to?.slice(0, 10) ?? '';
  if (!rule.is_active) return 'expired';
  if (to && to < t) return 'expired';
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

export type BuffetRuleDraft = {
  buffet_id: string;
  time_slot_id: string;
  calendar_kind: BuffetCalendarKind;
  valid_from: string;
  /** Empty string = long-term (no end date). */
  valid_to: string;
  adult_price: number;
  child_price: number;
  priority: number;
  is_active: boolean;
  note: string;
};

export function buildBuffetRuleDraft(
  buffets: Buffet[],
  slots: BuffetTimeSlot[],
  overrides?: Partial<BuffetRuleDraft>,
): BuffetRuleDraft | null {
  if (!buffets[0] || !slots[0]) return null;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const base: BuffetRuleDraft = {
    buffet_id: buffets[0].id,
    time_slot_id: slots[0].id,
    calendar_kind: 'weekday',
    valid_from: `${y}-${m}-${d}`,
    valid_to: '',
    adult_price: 20,
    child_price: 10,
    priority: 0,
    is_active: true,
    note: '',
  };
  return { ...base, ...overrides };
}

export function buffetRuleToDraft(rule: BuffetPriceRule): BuffetRuleDraft {
  return {
    buffet_id: rule.buffet_id,
    time_slot_id: rule.time_slot_id,
    calendar_kind: rule.calendar_kind,
    valid_from: rule.valid_from?.slice(0, 10) ?? '',
    valid_to: rule.valid_to?.slice(0, 10) ?? '',
    adult_price: Number(rule.adult_price),
    child_price: Number(rule.child_price),
    priority: rule.priority,
    is_active: rule.is_active,
    note: rule.note ?? '',
  };
}

export type BuffetRuleDraftValidation =
  | { ok: true }
  | { ok: false; reason: 'date_required' | 'invalid_date_range' | 'conflict'; overlaps: BuffetPriceRule[] };

export function validateBuffetRuleDraft(
  draft: BuffetRuleDraft,
  rules: BuffetPriceRule[],
  options: { excludeId?: string; skipConflict?: boolean } = {},
): BuffetRuleDraftValidation {
  if (!draft.valid_from) {
    return { ok: false, reason: 'date_required', overlaps: [] };
  }
  if (draft.valid_to && draft.valid_to < draft.valid_from) {
    return { ok: false, reason: 'invalid_date_range', overlaps: [] };
  }
  const overlaps = findOverlappingRules(rules, {
    buffet_id: draft.buffet_id,
    time_slot_id: draft.time_slot_id,
    calendar_kind: draft.calendar_kind,
    valid_from: draft.valid_from,
    valid_to: draft.valid_to || null,
    excludeId: options.excludeId,
  });
  if (!options.skipConflict && overlaps.length > 0) {
    return { ok: false, reason: 'conflict', overlaps };
  }
  return { ok: true };
}

/** One buffet × slot with the calendar kinds that have no rule effective on the given date. */
export type BuffetMissingPriceCell = {
  buffetId: string;
  slotId: string;
  kinds: BuffetCalendarKind[];
};

/** Calendar kinds a slot can actually be priced under (weekday set + Friday-weekend policy). */
function calendarKindsForSlot(
  slot: Pick<BuffetTimeSlot, 'weekdays'>,
  fridayWeekendFrom: string | null | undefined,
): BuffetCalendarKind[] {
  const days = slot.weekdays ?? [];
  const kinds: BuffetCalendarKind[] = [];
  if (days.some((d) => d >= 1 && d <= 5)) kinds.push('weekday');
  if (days.includes(0) || days.includes(6) || (Boolean(fridayWeekendFrom) && days.includes(5))) {
    kinds.push('weekend');
  }
  if (days.length > 0) kinds.push('holiday', 'special');
  return kinds;
}

/**
 * Sole「缺价提示」: every active buffet × slot × calendar kind with no active rule covering
 * `dateIso` (Lisbon today) — those times the buffet cannot be opened (`buffet_openable_ids`).
 */
export function findMissingBuffetPriceCells(params: {
  buffets: Array<Pick<Buffet, 'id' | 'is_active'>>;
  slots: Array<Pick<BuffetTimeSlot, 'id' | 'weekdays'>>;
  rules: BuffetPriceRule[];
  dateIso: string;
  fridayWeekendFrom?: string | null;
}): BuffetMissingPriceCell[] {
  const cells: BuffetMissingPriceCell[] = [];
  for (const buffet of params.buffets) {
    if (!buffet.is_active) continue;
    for (const slot of params.slots) {
      const kinds = calendarKindsForSlot(slot, params.fridayWeekendFrom).filter(
        (kind) =>
          !hasActiveRuleForDayKind(params.rules, {
            buffetId: buffet.id,
            calendarKind: kind,
            dateIso: params.dateIso,
            timeSlotId: slot.id,
          }),
      );
      if (kinds.length > 0) cells.push({ buffetId: buffet.id, slotId: slot.id, kinds });
    }
  }
  return cells;
}
