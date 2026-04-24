'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';

interface Props {
  initialOrders: Order[];
}

export function OrdersHistoryManager({ initialOrders }: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const locale = UI_LOCALE_BY_LANG[lang];
  const [tableFilter, setTableFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const statusLabel: Record<OrderStatus, string> = {
    pending: i18n.pending,
    cooking: i18n.cooking,
    done: i18n.done,
  };
  const statusColor: Record<OrderStatus, string> = {
    pending: 'bg-red-400/15 text-red-400',
    cooking: 'bg-yellow-400/15 text-yellow-400',
    done: 'bg-green-400/15 text-green-400',
  };

  const filteredOrders = useMemo(() => {
    return initialOrders.filter(order => {
      if (tableFilter && !String(order.table_number).includes(tableFilter.trim())) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      if (fromDate) {
        const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
        if (new Date(order.created_at).getTime() < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(`${toDate}T23:59:59`).getTime();
        if (new Date(order.created_at).getTime() > toTs) return false;
      }
      return true;
    });
  }, [initialOrders, tableFilter, statusFilter, fromDate, toDate]);

  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) return;

    const createdAt = new Date(order.created_at).toLocaleString(locale);
    const rows = order.items.map(item => `
      <tr>
        <td style="padding:6px 0;">${item.emoji} ${item.name_pt}</td>
        <td style="padding:6px 0; text-align:center;">x${item.qty}</td>
        <td style="padding:6px 0; text-align:right;">€${(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head><title>${i18n.printTitle} #${order.id.slice(0, 8)}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
          <h2 style="margin-bottom: 8px;">${i18n.printTitle}</h2>
          <div style="font-size: 14px; margin-bottom: 14px;">
            <div>${i18n.table} ${order.table_number}</div>
            <div>${createdAt}</div>
            <div>${statusLabel[order.status]}</div>
          </div>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="border-bottom:1px solid #ddd;">
                <th style="text-align:left; padding:6px 0;">${i18n.printDish}</th>
                <th style="text-align:center; padding:6px 0;">${i18n.printQty}</th>
                <th style="text-align:right; padding:6px 0;">${i18n.printAmount}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top: 14px; text-align: right; font-weight: 700;">${i18n.printTotal}: €${order.total_amount.toFixed(2)}</div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div>
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 mb-4 grid gap-3 md:grid-cols-4">
        <input
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}
          placeholder={i18n.filterTable}
          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | OrderStatus)}
          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        >
          <option value="all">{i18n.statusAll}</option>
          <option value="pending">{i18n.pending}</option>
          <option value="cooking">{i18n.cooking}</option>
          <option value="done">{i18n.done}</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-brand-card border border-brand-border rounded-xl px-6 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-brand-text font-medium">{i18n.table} {order.table_number}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </div>
                    <p className="text-brand-text-muted text-xs mt-1">
                      {new Date(order.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-brand-gold font-medium">€{order.total_amount.toFixed(2)}</p>
                  <p className="text-brand-text-muted text-xs mt-1">{order.items.length} {i18n.items}</p>
                  <button
                    type="button"
                    onClick={() => handlePrintOrder(order)}
                    className="mt-2 text-xs text-brand-gold hover:underline"
                  >
                    {i18n.print}
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-brand-border flex flex-wrap gap-3">
                {order.items.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-brand-border px-3 py-1 rounded-full text-brand-text-muted"
                  >
                    {item.emoji} {item.name_pt} x {item.qty}
                    {item.note && <span className="text-yellow-400 ml-1">({item.note})</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
