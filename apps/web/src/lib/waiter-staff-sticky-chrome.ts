/**
 * Sticky offsets under Dashboard / Waiter top bars (`h-14` / 3.5rem).
 * Board lane chrome and table-detail page identity share `belowStaffTopBar`.
 * Detail ordered-items sticks under page identity (= top bar + `h-14` heading).
 */
export const waiterStaffStickyChrome = {
  belowStaffTopBar: 'top-14',
  belowPageHeading: 'top-28',
} as const;
