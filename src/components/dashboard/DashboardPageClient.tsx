'use client';

import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';

export interface DashboardTopItem {
  name: string;
  emoji: string;
  count: number;
}

interface Props {
  todayOrderCount: number;
  todayRevenue: number;
  doneOrderCount: number;
  menuCount: number;
  topItems: DashboardTopItem[];
  recentOrders: Order[];
}

export function DashboardPageClient({
  todayOrderCount,
  todayRevenue,
  doneOrderCount,
  menuCount,
  topItems,
  recentOrders,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).dashboard;
  const locale = UI_LOCALE_BY_LANG[lang];

  const stats = [
    { label: i18n.todayOrders, value: todayOrderCount, unit: i18n.unitOrder, color: 'text-brand-gold' },
    { label: i18n.todayRevenue, value: `€${todayRevenue.toFixed(2)}`, unit: '', color: 'text-green-400' },
    { label: i18n.doneOrders, value: doneOrderCount, unit: i18n.unitOrder, color: 'text-blue-400' },
    { label: i18n.menuCount, value: menuCount, unit: i18n.unitDish, color: 'text-purple-400' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-brand-text">{i18n.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <p className="text-brand-text-muted text-[13px] mb-2">{stat.label}</p>
            <p className={`font-heading text-2xl sm:text-3xl ${stat.color}`}>
              {stat.value}
              {stat.unit && <span className="text-base ml-1 text-brand-text-muted">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-heading text-xl text-brand-gold mb-4">{i18n.topItems}</h2>
          {topItems.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{i18n.noToday}</p>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-brand-text-muted text-sm w-5">{i + 1}</span>
                  <span className="text-xl">{item.emoji}</span>
                  <span className="flex-1 text-sm text-brand-text truncate">{item.name}</span>
                  <span className="text-brand-gold text-sm font-medium">
                    {item.count} {i18n.serving}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-heading text-xl text-brand-gold mb-4">{i18n.recent}</h2>
          {recentOrders.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{i18n.noOrders}</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-2 border-b border-brand-border last:border-0"
                >
                  <div>
                    <p className="text-sm text-brand-text">
                      {i18n.table} {order.table_number}
                    </p>
                    <p className="text-[13px] text-brand-text-muted">
                      {new Date(order.created_at).toLocaleString(locale, {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-brand-gold">€{order.total_amount.toFixed(2)}</p>
                    <span
                      className={`text-[13px] px-2 py-0.5 rounded-full ${
                        order.status === 'done'
                          ? 'bg-green-400/15 text-green-400'
                          : order.status === 'cooking'
                            ? 'bg-yellow-400/15 text-yellow-400'
                            : 'bg-red-400/15 text-red-400'
                      }`}
                    >
                      {order.status === 'done'
                        ? i18n.done
                        : order.status === 'cooking'
                          ? i18n.cooking
                          : i18n.pending}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
