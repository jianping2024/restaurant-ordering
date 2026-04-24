import { createClient } from '@/lib/supabase/server';
import type { BillSplit, Order } from '@/types';
import { getServerLanguage } from '@/lib/i18n.server';
import { getMessages } from '@/lib/i18n/messages';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{i18n.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{i18n.total} {orders?.length || 0} {i18n.records}</p>
      </div>

      <CheckoutRequestsManager initialRequests={(checkoutRequests || []) as BillSplit[]} />

      <OrdersHistoryManager initialOrders={(orders || []) as Order[]} />
    </div>
  );
}
