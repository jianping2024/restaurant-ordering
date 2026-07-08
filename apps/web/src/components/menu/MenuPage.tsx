'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MenuItem, CartItem, MenuCategory } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { CartDrawer } from './CartDrawer';
import { CATEGORY_LABELS, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { formatOrderItemListLabel, orderListGuestLabelsFromLang } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { coerceCartPrice, coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import { showToast } from '@/components/ui/Toast';
import {
  completeGuestOrderSubmit,
  completeStaffAssistedOrderSubmit,
} from '@/lib/menu-order-submit-outcome';
import { scheduleMenuOrderPostSubmitEffects } from '@/lib/menu-order-post-submit';
import {
  appendFailureNeedsSessionRefresh,
  executeMenuOrderSubmit,
  type MenuOrderSubmitFailure,
} from '@/lib/menu-order-submit';
import {
  resolveCustomerGeoForOrder,
  warmCustomerGeoForOrder,
} from '@/lib/customer-geo-order';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import {
  guestOrderGateFromCachedState,
  guestOrderGateFromSessionContext,
  guestOrderingActionHint,
} from '@/lib/customer-menu-order-gate';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import { useCustomerSessionContext } from '@/lib/use-customer-session-context';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { waiterBillHref } from '@/lib/staff-routes';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';

interface Props {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    geo_latitude?: number | null;
    geo_longitude?: number | null;
    order_radius_meters?: number | null;
    feature_flags?: Record<string, boolean> | null;
  };
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  tableId: string;
  displayName: string;
  initialSessionContext?: CustomerSessionContext | null;
  isDemo?: boolean;
  staffAssisted?: StaffAssistedFlow | null;
}

export function MenuPage({
  restaurant,
  menuItems,
  menuCategories,
  tableId,
  displayName,
  initialSessionContext = null,
  isDemo,
  staffAssisted = null,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const [activeTopCategory, setActiveTopCategory] = useState<string>('Pratos');
  const [activeSubpath, setActiveSubpath] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [demoToast, setDemoToast] = useState(false);
  const [latestBatchId, setLatestBatchId] = useState<string | null>(null);

  const {
    activeSession,
    recentOrders,
    sessionResolved,
    refresh: refreshSessionContext,
  } = useCustomerSessionContext(initialSessionContext, {
    slug: restaurant.slug,
    tableId,
    isDemo,
  });

  const ensureGuestCanPlaceOrder = useCallback(async () => {
    if (!sessionResolved) {
      const data = await refreshSessionContext();
      return guestOrderGateFromSessionContext(data);
    }
    const cached = guestOrderGateFromCachedState(isDemo ?? false, activeSession, recentOrders);
    if (cached) return cached;
    const data = await refreshSessionContext();
    return guestOrderGateFromSessionContext(data);
  }, [activeSession, isDemo, recentOrders, refreshSessionContext, sessionResolved]);

  // 当前分类菜品
  const topCategories = menuCategories.filter((c) => !c.parent_id && c.active).sort((a, b) => a.sort_order - b.sort_order);
  const currentTop = topCategories.some((c) => c.id === activeTopCategory) ? activeTopCategory : (topCategories[0]?.id || '');
  const subCategories = menuCategories.filter((c) => c.parent_id === currentTop && c.active).sort((a, b) => a.sort_order - b.sort_order);
  const currentSubpath = subCategories.some((c) => c.id === activeSubpath) ? activeSubpath : '';
  const labelMap = CATEGORY_LABELS[lang] as Record<string, string>;
  const localizedCategoryLabel = (c: MenuCategory) => {
    if (lang === 'en') return c.name_en || c.name_pt;
    if (lang === 'zh') return c.name_zh || c.name_pt;
    return c.name_pt || labelMap[c.name_pt] || c.name_pt;
  };

  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    menuCategories
      .filter((c) => c.active && c.parent_id)
      .forEach((category) => {
        const parentId = category.parent_id as string;
        const list = map.get(parentId) || [];
        list.push(category.id);
        map.set(parentId, list);
      });
    return map;
  }, [menuCategories]);

  const collectDescendantIds = (rootId: string) => {
    const ids = new Set<string>();
    const walk = (id: string) => {
      const children = childrenByParent.get(id) || [];
      children.forEach((childId) => {
        if (ids.has(childId)) return;
        ids.add(childId);
        walk(childId);
      });
    };
    walk(rootId);
    return ids;
  };

  const currentItems = menuItems.filter((item) => {
    if (!currentTop) return true;
    if (!item.category_id) return false;

    if (currentSubpath) {
      if (item.category_id === currentSubpath) return true;
      const descendants = collectDescendantIds(currentSubpath);
      return descendants.has(item.category_id);
    }

    if (item.category_id === currentTop) return true;
    const descendants = collectDescendantIds(currentTop);
    return descendants.has(item.category_id);
  });

  const guestCanOrder = useMemo(
    () => sessionResolved && guestOrderingEnabled(activeSession, recentOrders),
    [activeSession, recentOrders, sessionResolved],
  );
  const guestOrderingHints = useMemo(() => {
    const messages = MENU_PAGE_MESSAGES[lang];
    if (activeSession?.status === 'billing') {
      return { banner: messages.billDisabledHint, action: messages.billDisabledHint };
    }
    return { banner: messages.waitingForBuffet, action: messages.buffetRequired };
  }, [activeSession?.status, lang]);

  const updateQty = (menuItemId: string, qty: number) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
    } else {
      setCart((prev) =>
        prev.map((c) => (c.menuItemId === menuItemId ? { ...c, qty: n } : c)),
      );
    }
  };

  // 列表步进器 / 抽屉共用：仅改本地 cart，提交仍走 submitOrder → orders/append
  const bumpCartItem = async (item: MenuItem, delta: number) => {
    const gate = await ensureGuestCanPlaceOrder();
    if (!gate.canPlace) {
      showToast(guestOrderingActionHint(lang, gate.sessionStatus), 'info');
      return;
    }
    const current = coerceCartQty(cart.find((c) => c.menuItemId === item.id)?.qty);
    const next = current + delta;
    if (next <= 0) {
      updateQty(item.id, 0);
      return;
    }
    if (current === 0) {
      setCart((prev) => [
        ...prev,
        {
          menuItemId: item.id,
          name_pt: item.name_pt,
          name_en: item.name_en,
          name_zh: item.name_zh,
          price: coerceCartPrice(item.price),
          emoji: item.emoji,
          qty: next,
          note: '',
          notePresetKeys: item.note_preset_keys || [],
        },
      ]);
      return;
    }
    updateQty(item.id, next);
  };

  // 更新备注
  const updateNote = (menuItemId: string, note: string) => {
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, note } : c));
  };

  const totalQty = cart.reduce((sum, c) => sum + coerceCartQty(c.qty), 0);
  const totalPrice = sumLineTotals(cart);
  const t = MENU_PAGE_MESSAGES[lang];
  const locale = UI_LOCALE_BY_LANG[lang];
  const orderListGuestLabels = useMemo(() => orderListGuestLabelsFromLang(lang), [lang]);
  const isLocalDevHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const { totalItemCount } = recentOrders.reduce((acc, order) => {
    acc.totalItemCount += order.items.length;
    return acc;
  }, { totalItemCount: 0 });
  const pageBottomPaddingClass = totalQty > 0 ? 'pb-28' : 'pb-16';
  // 只要本桌本餐次有下单记录，即可随时进入结账页。
  const canGoBill = !!activeSession && totalItemCount > 0;
  const canShowBillCta = staffAssisted
    ? staffAssisted.showBillCta && !!activeSession
    : !!activeSession;
  const billHref = staffAssisted?.showBillCta
    ? waiterBillHref(restaurant.slug, tableId, { embeddedInDashboard: true })
    : `/${restaurant.slug}/bill?table_id=${encodeURIComponent(tableId)}`;

  const clearSubmitCart = useCallback(() => {
    setCart([]);
    setCartOpen(false);
  }, []);

  const completeGuestSubmit = useCallback(
    (batchId: string) => {
      completeGuestOrderSubmit({
        batchId,
        orderSuccessMessage: t.orderSuccess,
        clearCart: clearSubmitCart,
        setLatestBatchId,
      });
    },
    [clearSubmitCart, t.orderSuccess],
  );

  const completeStaffAssistedSubmit = useCallback(() => {
    if (!staffAssisted) return;
    completeStaffAssistedOrderSubmit({
      returnHref: staffAssisted.returnHref,
      clearCart: clearSubmitCart,
      navigate: (href) => router.push(href),
    });
  }, [clearSubmitCart, router, staffAssisted]);

  useEffect(() => {
    if (!staffAssisted) return;
    router.prefetch(staffAssisted.returnHref);
  }, [router, staffAssisted]);

  useEffect(() => {
    if (isDemo || staffAssisted) return;
    warmCustomerGeoForOrder({ restaurant, isWaiterFlow: false });
  }, [isDemo, restaurant, staffAssisted]);

  const showSubmitFailure = useCallback(
    async (failure: MenuOrderSubmitFailure) => {
      if (failure.kind === 'gate') {
        showToast(guestOrderingActionHint(lang, failure.sessionStatus), 'info');
        return;
      }
      if (failure.kind === 'geo') {
        if (failure.reason === 'too_far') showToast(t.locationTooFar, 'error');
        else if (failure.reason === 'permission_denied') showToast(t.locationPermissionDenied, 'error');
        else if (failure.reason === 'not_supported') showToast(t.locationNotSupported, 'error');
        else showToast(t.locationCheckFailed, 'error');
        return;
      }
      if (failure.kind === 'append') {
        if (appendFailureNeedsSessionRefresh(failure.code)) {
          await refreshSessionContext();
          showToast(t.billDisabledHint, 'info');
          return;
        }
        if (failure.code === 'location_too_far') showToast(t.locationTooFar, 'error');
        else if (failure.code === 'location_required') showToast(t.locationPermissionDenied, 'error');
        else if (failure.code === 'buffet_required') showToast(t.buffetRequired, 'info');
        else if (failure.code === 'order_cooldown_limited') showToast(t.orderCooldownLimited, 'info');
        else if (failure.code === 'rate_limited') showToast(t.printEnqueueRateLimited, 'error');
        else showToast(t.submitFailed, 'error');
        return;
      }
      showToast(t.submitFailed, 'error');
    },
    [lang, refreshSessionContext, t],
  );

  // 提交订单
  const submitOrder = async () => {
    if (cart.length === 0) return;

    if (isDemo) {
      const gate = await ensureGuestCanPlaceOrder();
      if (!gate.canPlace) {
        showToast(guestOrderingActionHint(lang, gate.sessionStatus), 'info');
        return;
      }
      if (staffAssisted) {
        completeStaffAssistedSubmit();
        return;
      }
      setCart([]);
      setCartOpen(false);
      setDemoToast(true);
      setTimeout(() => setDemoToast(false), 3500);
      return;
    }

    setSubmitting(true);

    try {
      const waiterFlow = !!staffAssisted;
      const result = await executeMenuOrderSubmit({
        flow: waiterFlow ? 'staff_assisted' : 'guest',
        cart,
        slug: restaurant.slug,
        tableId,
        waiterFlow,
        ensureGate: ensureGuestCanPlaceOrder,
        resolveGeo: () =>
          resolveCustomerGeoForOrder({
            restaurant,
            isWaiterFlow: waiterFlow,
            isLocalDevHost,
          }),
      });

      if ('kind' in result) {
        await showSubmitFailure(result);
        return;
      }

      scheduleMenuOrderPostSubmitEffects({
        slug: restaurant.slug,
        orderId: result.orderId,
        batchId: result.batchId,
        enqueueToken: result.enqueueToken,
        waiterFlow,
        lang,
        sessionId: result.sessionId,
        refreshSession: refreshSessionContext,
      });

      if (waiterFlow) {
        completeStaffAssistedSubmit();
      } else {
        completeGuestSubmit(result.batchId);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[MenuPage.submitOrder] failed:', error);
      }
      showToast(t.submitFailed, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-brand-bg max-w-mobile mx-auto relative ${pageBottomPaddingClass}`}>
      {/* Demo 模式提示 toast */}
      {demoToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
          <div className="bg-brand-card border border-brand-gold/40 rounded-2xl px-5 py-4 shadow-xl text-center">
            <p className="text-brand-gold text-sm font-semibold mb-0.5">{t.demoToastTitle}</p>
            <p className="text-brand-text-muted text-[13px]">{t.demoToastDesc}</p>
          </div>
        </div>
      )}

      {/* Demo 顶部 banner */}
      {isDemo && (
        <div className="bg-brand-gold/10 border-b border-brand-gold/30 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-brand-gold text-[13px]">{t.demoMode}</p>
            <a
              href="/auth/login"
              className="flex-shrink-0 text-[13px] bg-brand-gold text-brand-on-gold px-3 py-1 rounded-full font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {t.freeSignup}
            </a>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-[13px] text-brand-text">{t.demoStep}</span>
            <Link
              href="/demo/kitchen"
              className="text-[13px] rounded-lg border border-brand-border px-2.5 py-1 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.demoOpenKitchen}
            </Link>
            <Link
              href="/demo/waiter"
              className="text-[13px] rounded-lg border border-brand-border px-2.5 py-1 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.demoOpenWaiter}
            </Link>
            <Link
              href="/demo"
              className="text-[13px] rounded-lg border border-brand-border px-2.5 py-1 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.demoBackHub}
            </Link>
          </div>
        </div>
      )}

      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        staffAssisted={staffAssisted}
        sticky
      >
        <div className="flex gap-0 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {topCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveTopCategory(cat.id);
                setActiveSubpath('');
              }}
              className={`flex-shrink-0 px-4 py-2 text-sm transition-all border-b-2 ${
                currentTop === cat.id
                  ? 'border-brand-gold text-brand-gold font-medium'
                  : 'border-transparent text-brand-text-muted'
              }`}
            >
              {localizedCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {subCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
            <button
              onClick={() => setActiveSubpath('')}
              className={`flex-shrink-0 px-3 py-1.5 text-[13px] rounded-full border transition-colors ${
                currentSubpath === ''
                  ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                  : 'border-brand-border text-brand-text-muted'
              }`}
            >
              {t.subcategoryAll}
            </button>
            {subCategories.map((subpath) => (
              <button
                key={subpath.id}
                onClick={() => setActiveSubpath(subpath.id)}
                className={`flex-shrink-0 px-3 py-1.5 text-[13px] rounded-full border transition-colors ${
                  currentSubpath === subpath.id
                    ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                    : 'border-brand-border text-brand-text-muted'
                }`}
              >
                {localizedCategoryLabel(subpath)}
              </button>
            ))}
          </div>
        )}
      </CustomerOrderingHeader>

      {!isDemo && sessionResolved && !guestCanOrder && (
        <div className="mx-4 mt-3 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3 text-[13px] text-brand-text">
          {guestOrderingHints.banner}
        </div>
      )}

      {/* 本桌已下单记录 */}
      <section className="px-4 pt-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
          <h2 className="font-heading text-lg text-brand-gold mb-1">{t.orderedTitle}</h2>
          {recentOrders.length > 0 && (
            <p className="text-brand-text-muted text-[12px] mb-3">{t.orderedSubmittedHint}</p>
          )}
          {!sessionResolved ? (
            <div className="space-y-2 animate-pulse" aria-hidden="true">
              <div className="h-4 w-2/3 rounded bg-brand-border/40" />
              <div className="h-14 rounded-xl bg-brand-border/30" />
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{t.noOrders}</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="border border-brand-border rounded-xl p-3">
                  <div className="mb-2">
                    <span className="text-[13px] text-brand-text-muted">
                      {new Date(order.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => {
                      if (normalizeOrderItemStatus(item, order.status) === 'voided') return null;
                      return (
                      <div key={`${order.id}-${idx}`} className="flex items-center justify-between gap-2">
                        <p className="text-sm text-brand-text">
                          {formatOrderItemListLabel(item, {
                            headcountStyle: 'localized',
                            guestLabels: orderListGuestLabels,
                          })}
                        </p>
                        {latestBatchId && item.batch_id === latestBatchId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-semibold">
                            {t.newTag}
                          </span>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canShowBillCta ? (
            <div className="mt-4 pt-3 border-t border-brand-border">
              <Link
                href={billHref}
                aria-disabled={!canGoBill}
                className={`w-full block text-center rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  canGoBill
                    ? 'bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light'
                    : 'bg-brand-border text-brand-text-muted pointer-events-none'
                }`}
              >
                {t.billCta}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* 菜品列表 */}
      <div className="px-4 py-4 space-y-3">
        {currentItems.length === 0 ? (
          <p className="text-center text-brand-text-muted py-12 text-sm">{t.noItems}</p>
        ) : (
          currentItems.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              lang={lang}
              cartQty={coerceCartQty(cart.find(c => c.menuItemId === item.id)?.qty)}
              onIncrement={() => bumpCartItem(item, 1)}
              onDecrement={() => bumpCartItem(item, -1)}
            />
          ))
        )}
      </div>

      {totalQty > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-brand-gold text-brand-on-gold rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl shadow-brand-gold/20 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="bg-brand-bg text-brand-gold w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center">
                {totalQty}
              </span>
              <span className="font-semibold text-sm">{t.viewCart}</span>
            </div>
            <span className="font-heading text-lg font-semibold">€{totalPrice.toFixed(2)}</span>
          </button>
        </div>
      ) : null}

      {/* 购物车抽屉 */}
      <CartDrawer
        open={cartOpen}
        cart={cart}
        lang={lang}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateQty}
        onUpdateNote={updateNote}
        onSubmit={submitOrder}
        submitting={submitting}
      />
    </div>
  );
}
