type IconProps = { className?: string };

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
