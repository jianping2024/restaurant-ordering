import Link from 'next/link';

type Props = {
  href: string;
  label: string;
  className?: string;
};

export function StaffAssistedBackLink({ href, label, className = '' }: Props) {
  return (
    <Link
      href={href}
      className={`text-[13px] text-brand-text-muted hover:text-brand-gold transition-colors ${className}`.trim()}
    >
      ← {label}
    </Link>
  );
}
