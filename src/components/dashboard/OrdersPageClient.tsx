'use client';

import type { BillSplit, Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

interface Props {
  orders: Order[];
  checkoutRequests: BillSplit[];
  restaurantSlug?: string;
  restaurantId?: string;
  tables?: RestaurantTableRow[];
  headingTitle?: string;
  headingNavKey?: 'orders' | 'unpaidOrders' | 'checkout';
  showCheckoutRequests?: boolean;
  showCloseTable?: boolean;
}

export function OrdersPageClient({
  orders,
  checkoutRequests,
  restaurantSlug,
  restaurantId,
  tables,
  headingTitle,
  headingNavKey,
  showCheckoutRequests = true,
  showCloseTable = false,
}: Props) {
  const { lang } = useLanguage();
  const nav = getMessages(lang).nav;
  const i18n = getMessages(lang).orderHistory;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{headingTitle || (headingNavKey ? nav[headingNavKey] : i18n.title)}</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {i18n.total} {orders.length} {i18n.records}
        </p>
      </div>

      {showCheckoutRequests && (
        <CheckoutRequestsManager
          initialRequests={checkoutRequests}
          restaurantSlug={restaurantSlug}
        />
      )}

      <OrdersHistoryManager
        initialOrders={orders}
        tables={tables}
        showCloseTable={showCloseTable}
        restaurantId={restaurantId}
      />
    </div>
  );
}
