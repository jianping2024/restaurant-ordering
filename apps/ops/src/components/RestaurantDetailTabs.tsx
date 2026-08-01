'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function RestaurantDetailTabs({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const pathname = usePathname();
  const base = `/ops/restaurants/${restaurantId}`;
  const tabs = [
    { href: base, label: '概览', exact: true },
    { href: `${base}/print`, label: '打印', exact: false },
    { href: `${base}/staff`, label: '员工', exact: false },
  ];

  return (
    <div className="mb-6">
      <Link href="/ops/restaurants" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← 返回列表
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{restaurantName}</h1>
      <nav className="mt-4 flex gap-4 border-b border-zinc-800 text-sm">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
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
    </div>
  );
}
