/**
 * Sole period model for value-analytics dish ranking.
 * Grains: month | quarter | year. Period keys: YYYY-MM | YYYY-Qn | YYYY.
 */

export type MenuItemConsumptionGrain = 'month' | 'quarter' | 'year';

export const MENU_ITEM_CONSUMPTION_GRAINS: readonly MenuItemConsumptionGrain[] = [
  'month',
  'quarter',
  'year',
] as const;

export type MenuItemConsumptionSort = 'asc' | 'desc';

const GRAIN_SET = new Set<string>(MENU_ITEM_CONSUMPTION_GRAINS);

export function parseMenuItemConsumptionGrain(
  raw: string | null,
): MenuItemConsumptionGrain | null {
  if (!raw) return 'month';
  if (GRAIN_SET.has(raw)) return raw as MenuItemConsumptionGrain;
  return null;
}

export function parseMenuItemConsumptionSort(raw: string | null): MenuItemConsumptionSort {
  return raw === 'asc' ? 'asc' : 'desc';
}

export function monthPeriodFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function quarterPeriodFromDate(dateStr: string): string {
  const month = Number(dateStr.slice(5, 7));
  const q = Math.ceil(month / 3);
  return `${dateStr.slice(0, 4)}-Q${q}`;
}

export function yearPeriodFromDate(dateStr: string): string {
  return dateStr.slice(0, 4);
}

export function defaultConsumptionPeriod(
  grain: MenuItemConsumptionGrain,
  today: string,
): string {
  if (grain === 'month') return monthPeriodFromDate(today);
  if (grain === 'quarter') return quarterPeriodFromDate(today);
  return yearPeriodFromDate(today);
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function monthStart(period: string): string {
  return `${period}-01`;
}

function monthEnd(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const last = daysInMonth(year, month);
  return `${period}-${String(last).padStart(2, '0')}`;
}

function quarterBounds(period: string): { start: string; end: string } {
  const year = Number(period.slice(0, 4));
  const q = Number(period.slice(6, 7));
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDay = daysInMonth(year, endMonth);
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { start, end };
}

function yearBounds(period: string): { start: string; end: string } {
  return { start: `${period}-01-01`, end: `${period}-12-31` };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const QUARTER_RE = /^\d{4}-Q[1-4]$/;
const YEAR_RE = /^\d{4}$/;

export function isValidConsumptionPeriod(
  grain: MenuItemConsumptionGrain,
  period: string,
): boolean {
  if (grain === 'month') return MONTH_RE.test(period);
  if (grain === 'quarter') return QUARTER_RE.test(period);
  return YEAR_RE.test(period);
}

/** Inclusive Lisbon calendar window for one ranking query; end capped at today. */
export function resolveConsumptionPeriodWindow(
  grain: MenuItemConsumptionGrain,
  period: string,
  today: string,
): { startDate: string; endDate: string } | null {
  if (!isValidConsumptionPeriod(grain, period)) return null;

  let startDate: string;
  let endDate: string;
  if (grain === 'month') {
    startDate = monthStart(period);
    endDate = monthEnd(period);
  } else if (grain === 'quarter') {
    const bounds = quarterBounds(period);
    startDate = bounds.start;
    endDate = bounds.end;
  } else {
    const bounds = yearBounds(period);
    startDate = bounds.start;
    endDate = bounds.end;
  }

  if (endDate > today) endDate = today;
  if (startDate > endDate) return null;
  return { startDate, endDate };
}

export function clampConsumptionPeriod(
  grain: MenuItemConsumptionGrain,
  period: string,
  today: string,
  earliestBusinessDate: string | null,
): string {
  const current = defaultConsumptionPeriod(grain, today);
  let next = isValidConsumptionPeriod(grain, period) ? period : current;
  if (next > current) next = current;
  if (earliestBusinessDate) {
    const minPeriod = defaultConsumptionPeriod(grain, earliestBusinessDate);
    if (next < minPeriod) next = minPeriod;
  }
  return next;
}

export function listMonthPeriods(earliest: string, today: string): string[] {
  const out: string[] = [];
  let cursor = monthPeriodFromDate(earliest);
  const last = monthPeriodFromDate(today);
  while (cursor <= last) {
    out.push(cursor);
    const year = Number(cursor.slice(0, 4));
    const month = Number(cursor.slice(5, 7));
    if (month === 12) cursor = `${year + 1}-01`;
    else cursor = `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  return out;
}

export function listQuarterPeriods(earliest: string, today: string): string[] {
  const out: string[] = [];
  let cursor = quarterPeriodFromDate(earliest);
  const last = quarterPeriodFromDate(today);
  while (cursor <= last) {
    out.push(cursor);
    const year = Number(cursor.slice(0, 4));
    const q = Number(cursor.slice(6, 7));
    if (q === 4) cursor = `${year + 1}-Q1`;
    else cursor = `${year}-Q${q + 1}`;
  }
  return out;
}

export function listYearPeriods(earliest: string, today: string): string[] {
  const out: string[] = [];
  let year = Number(yearPeriodFromDate(earliest));
  const last = Number(yearPeriodFromDate(today));
  while (year <= last) {
    out.push(String(year));
    year += 1;
  }
  return out;
}

export function listConsumptionPeriods(
  grain: MenuItemConsumptionGrain,
  earliest: string | null,
  today: string,
): string[] {
  const start = earliest && earliest <= today ? earliest : today;
  if (grain === 'month') return listMonthPeriods(start, today);
  if (grain === 'quarter') return listQuarterPeriods(start, today);
  return listYearPeriods(start, today);
}

export function formatQuarterPeriodLabel(period: string): string {
  const year = period.slice(0, 4);
  const q = period.slice(6, 7);
  return `${year} Q${q}`;
}
