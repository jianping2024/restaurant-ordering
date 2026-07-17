type IconProps = { className?: string };

export function WaiterTableIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4 13.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

/** Board card row2 — two overlapping silhouettes for seat capacity. */
export function WaiterSeatCapacityIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5.25" cy="4.75" r="1.55" stroke="currentColor" strokeWidth="1.05" />
      <path
        d="M2.5 12.75c0-1.55 1.1-2.65 2.75-2.65"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />
      <circle cx="10.35" cy="5.1" r="1.8" stroke="currentColor" strokeWidth="1.05" />
      <path
        d="M6.5 13.25c0-2.05 1.55-3.15 3.85-3.15s3.85 1.1 3.85 3.15"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WaiterClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 5v3.25l2 1.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function WaiterPlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WaiterPlusCircleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function WaiterTransferIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 5.5h9.5M10 3.5l2 2-2 2M13.5 10.5H4M6 8.5l-2 2 2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WaiterMergeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5.5" cy="5" r="1.75" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="10.5" cy="5" r="1.75" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.5 11.5c0-1.4 1.2-2.25 2-2.25M12.5 11.5c0-1.4-1.2-2.25-2-2.25M8 9.25v3.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function WaiterBillIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 2.5h7v11l-1.25-.75L9 13.5l-1-.75-1 .75-1.25-.75L4.5 13.5v-11Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      <path d="M6.5 6h3M6.5 8.25h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Board card footer — thin document lines for view-order actions. */
export function WaiterBoardOrderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="4.75"
        y="2.75"
        width="6.5"
        height="10.5"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="0.95"
      />
      <path d="M6.75 6h2.5M6.75 8.25h2.5" stroke="currentColor" strokeWidth="0.85" strokeLinecap="round" />
    </svg>
  );
}

export function WaiterPowerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2.5v4.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M5.25 4.1a4.25 4.25 0 1 0 5.5 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function WaiterClocheIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 9.25h10M4.25 9.25c0-2.35 1.75-4 3.75-4s3.75 1.65 3.75 4" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M2.75 9.75h10.5v.75c0 .55-.45 1-1 1H3.75c-.55 0-1-.45-1-1v-.75Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** Board KPI — floor overview as a 2×2 table grid. */
export function WaiterBoardKpiFloorIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Board KPI — bill / checkout request. */
export function WaiterBoardKpiBillIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.75h10a1.5 1.5 0 0 1 1.5 1.5v14.2l-2.1-1.15-2.15 1.35-2.25-1.35-2.15 1.35-2.1-1.15V5.25A1.5 1.5 0 0 1 7 3.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9.5 9h5M9.5 12.25h5M9.5 15.5h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Board KPI — guests dining (cloche). */
export function WaiterBoardKpiDiningIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4.5v1.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M5 13.5h14M6.75 13.5c0-3.6 2.35-6.25 5.25-6.25s5.25 2.65 5.25 6.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M4.5 14.25h15v1.1c0 .9-.7 1.65-1.6 1.65H6.1c-.9 0-1.6-.75-1.6-1.65v-1.1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Board KPI — vacant round table ready to open. */
export function WaiterBoardKpiVacantIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="8.5" rx="8" ry="3.75" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M6.5 11.75v5.5M12 12.25v5.75M17.5 11.75v5.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path d="M5.25 18.5h13.5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}
