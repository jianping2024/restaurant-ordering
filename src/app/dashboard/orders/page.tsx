import { createClient } from '@/lib/supabase/server';
import type { BillSplit, Order } from '@/types';
import { getServerLanguage } from '@/lib/i18n.server';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';

// 订单历史页
export default async function OrdersPage() {
  const lang = await getServerLanguage();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: checkoutRequests } = await supabase
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const i18n = getMessages(lang).orderHistory;
  const locale = UI_LOCALE_BY_LANG[lang];
  const statusLabel: Record<string, string> = {
    pending: i18n.pending,
    cooking: i18n.cooking,
    done: i18n.done,
  };
  const statusColor: Record<string, string> = {
    pending: 'bg-red-400/15 text-red-400',
    cooking: 'bg-yellow-400/15 text-yellow-400',
    done: 'bg-green-400/15 text-green-400',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{i18n.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{i18n.total} {orders?.length || 0} {i18n.records}</p>
      </div>

      <CheckoutRequestsManager initialRequests={(checkoutRequests || []) as BillSplit[]} />

      {!orders || orders.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(orders as Order[]).map(order => (
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
                </div>
              </div>

              {/* 订单明细 */}
              <div className="mt-3 pt-3 border-t border-brand-border flex flex-wrap gap-3">
                {order.items.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-brand-border px-3 py-1 rounded-full text-brand-text-muted"
                  >
                    {item.emoji} {item.name_pt} × {item.qty}
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
