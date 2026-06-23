'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/ops/print/devices', label: '设备' },
  { href: '/ops/print/jobs', label: '打印任务' },
  { href: '/ops/print/pairings', label: '配对码' },
];

export function PrintSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-4 border-b border-zinc-800 text-sm">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? '-mb-px border-b-2 border-amber-400 pb-2 text-white'
                : 'pb-2 text-zinc-400 hover:text-zinc-200'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
