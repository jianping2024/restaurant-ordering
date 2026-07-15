type IconProps = { className?: string };

/** Draft cart — shopping cart outline (customer menu footer). */
export function CustomerCartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4.75 4.75h1.1l.95 7.6a1.25 1.25 0 0 0 1.24 1.1h6.12a1.25 1.25 0 0 0 1.23-1.05l.72-4.32a.75.75 0 0 0-.74-.87H6.58"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.25" cy="16.25" r="1" fill="currentColor" />
      <circle cx="13.75" cy="16.25" r="1" fill="currentColor" />
    </svg>
  );
}

/** Ordered-items section — shopping bag outline (customer menu). */
export function CustomerOrderedBagIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4.5 5.5V4.75a3.25 3.25 0 0 1 6.5 0V5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M3.25 5.5h9.5l-.85 7.65a1 1 0 0 1-.99.85H5.09a1 1 0 0 1-.99-.85L3.25 5.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}
