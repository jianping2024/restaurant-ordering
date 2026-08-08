import Link from 'next/link';
import { PRODUCT_NAME } from '@mesa/shared';

const SIZE_CLASS = {
  sm: 'text-xl sm:text-2xl',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

const TONE_CLASS = {
  /** Marketing / auth / landing accent. */
  gold: 'text-brand-gold',
  /** Staff chrome wordmark — FARVOO floor mockup (azulejo ink). */
  ink: 'font-semibold text-brand-ink',
} as const;

type ProductLogoProps = {
  size?: keyof typeof SIZE_CLASS;
  href?: string;
  className?: string;
  /** Default gold for marketing surfaces; staff top bar uses ink. */
  tone?: keyof typeof TONE_CLASS;
};

export function ProductLogo({
  size = 'lg',
  href,
  className = '',
  tone = 'gold',
}: ProductLogoProps) {
  const label = (
    <span
      className={`font-heading tracking-wider ${TONE_CLASS[tone]} ${SIZE_CLASS[size]} ${className}`.trim()}
    >
      {PRODUCT_NAME}
    </span>
  );

  if (href) {
    return <Link href={href}>{label}</Link>;
  }

  return label;
}
