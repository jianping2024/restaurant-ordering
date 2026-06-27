type IconProps = { className?: string };

export function WaiterTableIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4 13.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
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
