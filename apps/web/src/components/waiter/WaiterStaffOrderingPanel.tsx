'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MenuOrderingController,
  type MenuOrderingRestaurant,
} from '@/components/menu/MenuOrderingController';
import { StaffOrderingShell } from '@/components/waiter/StaffOrderingShell';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import {
  ensureCustomerMenuCatalog,
  type CustomerMenuCatalog,
} from '@/lib/customer-menu-catalog-client-cache';
import { getDemoMenuCatalog } from '@/lib/demo-menu-catalog';
import { clampOrderCooldownSeconds } from '@/lib/order-submit-cooldown-client';
import type { MenuOrderSubmitSuccess } from '@/lib/menu-order-submit';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { waiterTableHref } from '@/lib/staff-routes';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { CartItem, Order } from '@/types';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  restaurant: MenuOrderingRestaurant;
  tableId: string;
  displayName: string;
  sessionMeta: WaiterTableSessionMeta | null;
  orders: Order[];
  cartDraft: CartItem[];
  onCartDraftChange: (cart: CartItem[]) => void;
  onStaffAppendSuccess: (result: MenuOrderSubmitSuccess, cart: CartItem[], catalog: CustomerMenuCatalog) => void;
  isDemo?: boolean;
  embeddedInDashboard?: boolean;
};

export function WaiterStaffOrderingPanel({
  open,
  title,
  onClose,
  restaurant,
  tableId,
  displayName,
  sessionMeta,
  orders,
  cartDraft,
  onCartDraftChange,
  onStaffAppendSuccess,
  isDemo = false,
  embeddedInDashboard = false,
}: Props) {
  const [catalog, setCatalog] = useState<CustomerMenuCatalog | null>(() =>
    isDemo ? getDemoMenuCatalog() : null,
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (isDemo) {
      setCatalog(getDemoMenuCatalog());
      setCatalogError(false);
      setCatalogLoading(false);
      return;
    }

    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(false);

    void ensureCustomerMenuCatalog({
      restaurantId: restaurant.id,
      slug: restaurant.slug,
    })
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogError(true);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemo, open, restaurant.id, restaurant.slug]);

  const staffAssisted = useMemo((): StaffAssistedFlow => ({
    returnHref: waiterTableHref(restaurant.slug, tableId, { isDemo, embeddedInDashboard }),
    variant: isDemo ? 'demo' : 'staff',
    redirectAfterSubmit: false,
    showBillCta: false,
    skipGeoFence: true,
    skipFeedback: true,
    checkoutRedirectHref: null,
  }), [embeddedInDashboard, isDemo, restaurant.slug, tableId]);

  const initialSessionContext = useMemo((): CustomerSessionContext | null => {
    if (!sessionMeta) return null;
    return {
      table_id: tableId,
      display_name: displayName,
      active_session: {
        id: sessionMeta.sessionId,
        restaurant_id: restaurant.id,
        table_id: tableId,
        status: sessionMeta.status,
        opened_at: sessionMeta.openedAt,
      },
      recent_orders: orders,
    };
  }, [displayName, orders, restaurant.id, sessionMeta, tableId]);

  const handleStaffAppendSuccess = (result: MenuOrderSubmitSuccess, submittedCart: CartItem[]) => {
    if (!catalog) return;
    onStaffAppendSuccess(result, submittedCart, catalog);
    onClose();
  };

  return (
    <StaffOrderingShell
      open={open}
      title={title}
      onClose={onClose}
      closeDisabled={submitting}
    >
      {catalogLoading ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-brand-text-muted">
          …
        </div>
      ) : catalogError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-brand-text-muted">菜单加载失败</p>
          <button
            type="button"
            className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text hover:border-brand-gold/40"
            onClick={() => {
              setCatalogError(false);
              if (isDemo) {
                setCatalog(getDemoMenuCatalog());
                return;
              }
              setCatalogLoading(true);
              void ensureCustomerMenuCatalog({
                restaurantId: restaurant.id,
                slug: restaurant.slug,
                forceRefresh: true,
              })
                .then(setCatalog)
                .catch(() => setCatalogError(true))
                .finally(() => setCatalogLoading(false));
            }}
          >
            重试
          </button>
        </div>
      ) : !catalog ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-brand-text-muted">
          …
        </div>
      ) : (
        <MenuOrderingController
          restaurant={restaurant}
          menuItems={catalog.menuItems}
          menuCategories={catalog.menuCategories}
          tableId={tableId}
          displayName={displayName}
          orderCooldownSeconds={clampOrderCooldownSeconds(restaurant.order_cooldown_seconds)}
          initialSessionContext={initialSessionContext}
          isDemo={isDemo}
          staffAssisted={staffAssisted}
          presentationMode="embedded"
          staffSubmitMode="overlay"
          initialCart={cartDraft}
          onCartDraftChange={onCartDraftChange}
          onStaffAppendSuccess={handleStaffAppendSuccess}
          onSubmittingChange={setSubmitting}
        />
      )}
    </StaffOrderingShell>
  );
}
