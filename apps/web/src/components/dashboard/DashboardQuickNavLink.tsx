import Link from 'next/link';

type DashboardQuickNavLinkProps = {
  href: string;
  icon: string;
  label: string;
};

export function DashboardQuickNavLink({ href, icon, label }: DashboardQuickNavLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-[13px] text-brand-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-text"
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
