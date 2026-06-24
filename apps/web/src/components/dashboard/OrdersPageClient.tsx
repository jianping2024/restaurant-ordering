'use client';

import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

interface Props {
  orders: Order[];
  restaurantId?: string;
  tables?: RestaurantTableRow[];
  headingTitle?: string;
  headingNavKey?: 'orders' | 'unpaidOrders';
  showCloseTable?: boolean;
  initialCheckoutRequestedTableIds?: string[];
}

export function OrdersPageClient({
  orders,
  restaurantId,
  tables,
  headingTitle,
  headingNavKey,
  showCloseTable = false,
  initialCheckoutRequestedTableIds = [],
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

      <OrdersHistoryManager
        initialOrders={orders}
        tables={tables}
        showCloseTable={showCloseTable}
        restaurantId={restaurantId}
        initialCheckoutRequestedTableIds={initialCheckoutRequestedTableIds}
      />
    </div>
  );
}
