import { normalizeLoginName } from './staff-account';
import type { RestaurantStaffAccount } from '../types';

export type StaffSortKey = 'login_name' | 'created_at';
export type StaffSortDir = 'asc' | 'desc';

/** Substring match on login_name (normalized), empty query returns all. */
export function filterStaffByLoginName(
  staff: readonly RestaurantStaffAccount[],
  search: string,
): RestaurantStaffAccount[] {
  const q = normalizeLoginName(search);
  if (!q) return [...staff];
  return staff.filter((row) => normalizeLoginName(row.login_name).includes(q));
}

export function sortStaffAccounts(
  staff: readonly RestaurantStaffAccount[],
  key: StaffSortKey,
  dir: StaffSortDir,
): RestaurantStaffAccount[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...staff].sort((a, b) => {
    const av = key === 'login_name' ? normalizeLoginName(a.login_name) : a.created_at;
    const bv = key === 'login_name' ? normalizeLoginName(b.login_name) : b.created_at;
    return av.localeCompare(bv) * mul || a.id.localeCompare(b.id);
  });
}
