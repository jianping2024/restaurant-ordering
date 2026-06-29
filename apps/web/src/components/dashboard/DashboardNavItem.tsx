import Link from 'next/link';
import { dashboardNavCheckoutBadgeClassName, dashboardNavLinkClassName } from '@/components/dashboard/dashboard-nav-link';

type DashboardNavItemProps = {
  href: string;
  active: boolean;
  icon: string;
  label: string;
  onNavigate?: () => void;
  external?: boolean;
  badge?: number;
};

export function DashboardNavItem({
  href,
  active,
  icon,
  label,
  onNavigate,
  external = false,
  badge,
}: DashboardNavItemProps) {
  const className = dashboardNavLinkClassName(active);
  const content = (
    <>
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
      {badge != null && badge > 0 ? (
        <span className={dashboardNavCheckoutBadgeClassName}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      {content}
    </Link>
  );
}
