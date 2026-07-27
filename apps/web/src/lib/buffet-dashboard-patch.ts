import type { BuffetDashboardData } from '@/lib/dashboard-buffet-server';

/** Partial dashboard update returned by buffet mutation APIs (GET still returns full data). */
export type BuffetDashboardPatch = Partial<BuffetDashboardData>;

export function mergeBuffetDashboardPatch(
  current: BuffetDashboardData,
  patch: BuffetDashboardPatch,
): BuffetDashboardData {
  return {
    buffets: patch.buffets ?? current.buffets,
    slots: patch.slots ?? current.slots,
    rules: patch.rules ?? current.rules,
    calendarRows: patch.calendarRows ?? current.calendarRows,
    buffet_friday_weekend_from:
      patch.buffet_friday_weekend_from !== undefined
        ? patch.buffet_friday_weekend_from
        : current.buffet_friday_weekend_from,
    buffet_service_mode:
      patch.buffet_service_mode !== undefined
        ? patch.buffet_service_mode
        : current.buffet_service_mode,
  };
}
