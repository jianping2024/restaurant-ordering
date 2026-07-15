'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MenuItem, CartItem, MenuCategory } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { CartDrawer } from './CartDrawer';
import { OrderedDrawer } from './OrderedDrawer';
import { CATEGORY_LABELS } from '@/lib/i18n/messages';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { customerMenuPageBottomPaddingClass } from '@/lib/customer-menu-bottom-bar-layout';
import { deriveMenuPageFooter } from '@/lib/menu-page-footer';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { coerceCartPrice, coerceCartQty } from '@/lib/cart-totals';
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
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { CustomerMenuFooter } from '@/components/menu/CustomerMenuFooter';
import { CustomerOrderingIntroModal } from '@/components/menu/CustomerOrderingIntroModal';
import { useSubmitCooldownRemaining } from '@/lib/use-submit-cooldown-remaining';
import { customerOrderingAudience } from '@/lib/customer-ordering-audience';
import { CUSTOMER_ORDERING_INTRO_MESSAGES } from '@/lib/i18n/customer-ordering-intro-messages';
import { useCustomerOrderingIntro } from '@/lib/use-customer-ordering-intro';

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
  orderCooldownSeconds: number;
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
  orderCooldownSeconds,
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
  const [orderedOpen, setOrderedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [demoToast, setDemoToast] = useState(false);
  const {
    submitCooldownRemaining,
    isSubmitCooldownActive,
    restartSubmitCooldown,
  } = useSubmitCooldownRemaining(orderCooldownSeconds);

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

  const orderingAudience = useMemo(
    () => customerOrderingAudience(staffAssisted),
    [staffAssisted],
  );
  const { visible: introVisible, dismiss: dismissIntro } = useCustomerOrderingIntro({
    restaurantSlug: restaurant.slug,
    audience: orderingAudience,
    sessionResolved,
  });
  const introCopy = CUSTOMER_ORDERING_INTRO_MESSAGES[lang];

  const ensureGuestCanPlaceOrder = useCallback(async () => {
    if (!sessionResolved) {
      const data = await refreshSessionContext();
      return guestOrderGateFromSessionContext(data);
    }
    const cached = guestOrderGateFromCachedState(isDemo ?? false, activeSession);
    if (cached) return cached;
    const data = await refreshSessionContext();
    return guestOrderGateFromSessionContext(data);
  }, [activeSession, isDemo, refreshSessionContext, sessionResolved]);

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
    () => sessionResolved && guestOrderingEnabled(activeSession),
    [activeSession, sessionResolved],
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

  const t = MENU_PAGE_MESSAGES[lang];
  const isLocalDevHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const footer = useMemo(
    () =>
      deriveMenuPageFooter({
        cart,
        recentOrders,
        activeSession,
        sessionResolved,
        staffAssisted,
        restaurantSlug: restaurant.slug,
        tableId,
      }),
    [activeSession, cart, recentOrders, restaurant.slug, sessionResolved, staffAssisted, tableId],
  );
  const pageBottomPaddingClass = customerMenuPageBottomPaddingClass(footer.visible);

  const formatCountLabel = useCallback(
    (template: string, count: number) => template.replace('{count}', String(count)),
    [],
  );

  const openCartDrawer = useCallback(() => {
    setOrderedOpen(false);
    setCartOpen(true);
  }, []);

  const openOrderedDrawer = useCallback(() => {
    setCartOpen(false);
    setOrderedOpen(true);
  }, []);

  const closeCartDrawer = useCallback(() => setCartOpen(false), []);
  const closeOrderedDrawer = useCallback(() => setOrderedOpen(false), []);

  const clearSubmitCart = useCallback(() => {
    setCart([]);
    setCartOpen(false);
  }, []);

  const completeGuestSubmit = useCallback(() => {
    completeGuestOrderSubmit({
      orderSuccessMessage: t.orderSuccess,
      clearCart: clearSubmitCart,
    });
  }, [clearSubmitCart, t.orderSuccess]);

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
        else if (failure.code === 'rate_limited') showToast(t.submitRateLimited, 'error');
        else showToast(t.submitFailed, 'error');
        return;
      }
      showToast(t.submitFailed, 'error');
    },
    [lang, refreshSessionContext, t],
  );

  // 提交订单
  const submitOrder = async () => {
    if (cart.length === 0 || isSubmitCooldownActive) return;

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
      restartSubmitCooldown();
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

      restartSubmitCooldown();

      if (waiterFlow) {
        completeStaffAssistedSubmit();
      } else {
        completeGuestSubmit();
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

      <CustomerMenuFooter
        {...footer}
        labels={{
          viewCart: t.viewCart,
          viewBill: t.viewBillLink,
          viewOrdered: t.viewOrdered,
          placeOrder: t.placeOrder,
          orderedCount: (count) => formatCountLabel(t.orderedCount, count),
        }}
        onOpenCart={openCartDrawer}
        onOpenOrdered={openOrderedDrawer}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        lang={lang}
        onClose={closeCartDrawer}
        onUpdateQty={updateQty}
        onUpdateNote={updateNote}
        onSubmit={submitOrder}
        submitting={submitting}
        submitCooldownRemaining={submitCooldownRemaining}
      />

      <OrderedDrawer
        open={orderedOpen}
        orders={recentOrders}
        lang={lang}
        sessionResolved={sessionResolved}
        labels={{
          title: formatCountLabel(t.orderedDrawerTitle, footer.submittedCount),
          empty: t.noOrders,
          submittedHint: t.orderedSubmittedHint,
          continueOrdering: t.continueOrdering,
          viewBill: t.viewBillLink,
        }}
        billHref={footer.billHref}
        billEnabled={footer.billEnabled}
        showBillLink={footer.showBillCta}
        onClose={closeOrderedDrawer}
      />

      <CustomerOrderingIntroModal
        open={introVisible}
        lang={lang}
        copy={introCopy}
        onDismiss={dismissIntro}
      />
    </div>
  );
}
