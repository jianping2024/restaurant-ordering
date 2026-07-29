import { normalizeLoginName } from './staff-account';
import type { RestaurantStaffAccount } from '../types';

export const STAFF_PAGE_SIZES = [10, 20] as const;
export type StaffPageSize = (typeof STAFF_PAGE_SIZES)[number];
export const STAFF_DEFAULT_PAGE_SIZE: StaffPageSize = 10;

export function isStaffPageSize(value: number): value is StaffPageSize {
  return (STAFF_PAGE_SIZES as readonly number[]).includes(value);
}

/** Substring match on login_name (normalized), empty query returns all. */
export function filterStaffByLoginName(
  staff: readonly RestaurantStaffAccount[],
  search: string,
): RestaurantStaffAccount[] {
  const q = normalizeLoginName(search);
  if (!q) return [...staff];
  return staff.filter((row) => normalizeLoginName(row.login_name).includes(q));
}
