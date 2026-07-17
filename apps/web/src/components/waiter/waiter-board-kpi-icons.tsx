import type { ComponentType } from 'react';
import type { WaiterBoardFilter } from '@/lib/waiter-board-session';

type IconProps = { className?: string };

/**
 * Waiter board KPI glyphs — floor semantics only (24 viewBox, heavier stroke).
 * Colors come from parent `currentColor` (status/brand), not hardcoded fills.
 */

/** All tables — 2×2 floor grid. */
export function WaiterBoardKpiFloorIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.75"
        y="2.75"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <rect
        x="13.75"
        y="2.75"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <rect
        x="2.75"
        y="13.75"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <rect
        x="13.75"
        y="13.75"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
    </svg>
  );
}

/** Checkout pending — bill / ticket. */
export function WaiterBoardKpiBillIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 3.5h11a1.75 1.75 0 0 1 1.75 1.75v14.4l-2.35-1.2-2.4 1.45-2.5-1.45-2.4 1.45-2.35-1.2V5.25A1.75 1.75 0 0 1 6.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M9.25 9h5.5M9.25 12.5h5.5M9.25 16h3.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Dining — cloche. */
export function WaiterBoardKpiDiningIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.75v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M4.5 13.75h15M6.25 13.75c0-4 2.55-6.75 5.75-6.75s5.75 2.75 5.75 6.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M3.75 14.5h16.5v1.25c0 1-.8 1.75-1.75 1.75H5.5c-.95 0-1.75-.75-1.75-1.75V14.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
    </svg>
  );
}

/** Vacant — round table with three legs + stretcher (not a stem glass). */
export function WaiterBoardKpiVacantIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse
        cx="12"
        cy="8"
        rx="8.25"
        ry="3.85"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M6.25 11.5v6M12 12v6.25M17.75 11.5v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M4.75 18.75h14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Table-driven KPI icons — one component per board filter. */
export const WAITER_BOARD_KPI_ICON_BY_FILTER: Record<
  WaiterBoardFilter,
  ComponentType<{ className?: string }>
> = {
  all: WaiterBoardKpiFloorIcon,
  checkout: WaiterBoardKpiBillIcon,
  dining: WaiterBoardKpiDiningIcon,
  idle: WaiterBoardKpiVacantIcon,
};
