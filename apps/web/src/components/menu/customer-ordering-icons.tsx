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

/** Sushi table round (未送厨本轮) — tray outline, never the draft cart glyph. */
export function CustomerRoundTrayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3.5 11.25h13a.75.75 0 0 1 .73.92l-.34 1.47a1.75 1.75 0 0 1-1.7 1.36H4.81a1.75 1.75 0 0 1-1.7-1.36l-.34-1.47a.75.75 0 0 1 .73-.92Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 11.25c0-2.35 1.9-4.25 4.25-4.25s4.25 1.9 4.25 4.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path d="M10 5v2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

/** Vegetarian dish — filled leaf + stem (sole veg glyph: card thumb, detail, filter legend). */
export function VegetarianLeafIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M17 3C9.5 3 4 6.8 4 12.6 4 15.2 5.9 17 8.6 17 14 17 17 12 17 3Z" fill="currentColor" />
      <path d="M2.75 17.75c2.5-3.6 5.4-6.6 9.25-9.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Restaurant notice (guest header) — megaphone outline. */
export function CustomerNoticeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3.75 8.5v3a1 1 0 0 0 1 1h1.75l6.25 3.5V4l-6.25 3.5H4.75a1 1 0 0 0-1 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.75 12.5l1 3.5M15.5 7.75a3 3 0 0 1 0 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
