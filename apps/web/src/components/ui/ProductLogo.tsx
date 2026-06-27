import Link from 'next/link';
import { PRODUCT_NAME } from '@mesa/shared';

const SIZE_CLASS = {
  sm: 'text-xl sm:text-2xl',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

type ProductLogoProps = {
  size?: keyof typeof SIZE_CLASS;
  href?: string;
  className?: string;
};

export function ProductLogo({ size = 'lg', href, className = '' }: ProductLogoProps) {
  const label = (
    <span
      className={`font-heading text-brand-gold tracking-wider ${SIZE_CLASS[size]} ${className}`.trim()}
    >
      {PRODUCT_NAME}
    </span>
  );

  if (href) {
    return <Link href={href}>{label}</Link>;
  }

  return label;
}
