type IconProps = { className?: string };

/** Language chrome glyph — globe outline. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.75 10h14.5M10 2.75c1.9 2 2.85 4.42 2.85 7.25S11.9 15.25 10 17.25M10 2.75C8.1 4.75 7.15 7.17 7.15 10s.95 5.25 2.85 7.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Theme chrome glyph — moon outline (switch to dark). */
export function MoonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M16.25 12.1A6.75 6.75 0 0 1 7.9 3.75a6.75 6.75 0 1 0 8.35 8.35Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Theme chrome glyph — sun outline (switch to light). */
export function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2.5v1.75M10 15.75v1.75M2.5 10h1.75M15.75 10h1.75M4.7 4.7l1.24 1.24M14.06 14.06l1.24 1.24M4.7 15.3l1.24-1.24M14.06 5.94l1.24-1.24"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
