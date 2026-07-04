type Props = {
  className?: string;
};

/** Read-only guest chip for customer split result rows. */
export function SplitPersonAvatar({ className = '' }: Props) {
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/14 border border-brand-gold/28 ${className}`.trim()}
      aria-hidden
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-brand-gold-dark" fill="currentColor">
        <circle cx="8" cy="5.5" r="2.4" />
        <path d="M3.5 13.25c0-2.35 1.95-3.75 4.5-3.75s4.5 1.4 4.5 3.75" />
      </svg>
    </span>
  );
}
