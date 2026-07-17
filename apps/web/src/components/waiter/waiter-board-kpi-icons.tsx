import type { ComponentType } from 'react';
import type { WaiterBoardFilter } from '@/lib/waiter-board-session';

type IconProps = { className?: string };

/**
 * Waiter board KPI glyphs — shared 24×24 artboard, ink in ~4…20 (optical center ~12,12).
 * Color via parent `currentColor`.
 */

/** All tables — 2×2 floor grid. */
export function WaiterBoardKpiFloorIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="6.5"
        height="6.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <rect
        x="13.5"
        y="4"
        width="6.5"
        height="6.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <rect
        x="4"
        y="13.5"
        width="6.5"
        height="6.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <rect
        x="13.5"
        y="13.5"
        width="6.5"
        height="6.5"
        rx="1.75"
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
        d="M7.25 4.25h9.5a1.5 1.5 0 0 1 1.5 1.5v12.85l-2.1-1.05-2.15 1.25-2.25-1.25-2.15 1.25-2.1-1.05V5.75a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M9.5 9h5M9.5 12h5M9.5 15h3"
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
      <path d="M12 4.5v1.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M5.25 13.25h13.5M6.75 13.25c0-3.5 2.35-5.75 5.25-5.75s5.25 2.25 5.25 5.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M4.5 14h15v1.1c0 .85-.7 1.55-1.55 1.55H6.05c-.85 0-1.55-.7-1.55-1.55V14Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
    </svg>
  );
}

/** Vacant — round table with three legs + stretcher. */
export function WaiterBoardKpiVacantIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse
        cx="12"
        cy="9"
        rx="7.25"
        ry="3.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M6.5 12v5.25M12 12.5v5.5M17.5 12v5.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M5.5 18.5h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
