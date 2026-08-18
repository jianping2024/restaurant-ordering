import { endOfMonth, startOfMonth } from 'date-fns';

/** Unbounded caption years when the caller does not pass min/max. */
function unboundedNavMonths(now: Date): { startMonth: Date; endMonth: Date } {
  const y = now.getFullYear();
  return { startMonth: new Date(y - 3, 0, 1), endMonth: new Date(y + 8, 11, 31) };
}

/**
 * Sole caption-nav window for DatePicker: min/max months when those bounds exist,
 * otherwise the unbounded fallback. Day disable still uses the same min/max.
 */
export function datePickerNavMonths(
  minDate: Date | undefined,
  maxDate: Date | undefined,
  now = new Date(),
): { startMonth: Date; endMonth: Date } {
  const fallback = unboundedNavMonths(now);
  return {
    startMonth: startOfMonth(minDate ?? fallback.startMonth),
    endMonth: endOfMonth(maxDate ?? fallback.endMonth),
  };
}
