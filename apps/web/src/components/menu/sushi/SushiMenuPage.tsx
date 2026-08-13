'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APPEND_CART_QTY_MAX, type MenuItem, type CartItem, type MenuCategory } from '@/types';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { CartDrawer } from '@/components/menu/CartDrawer';
import { OrderedDrawer } from '@/components/menu/OrderedDrawer';
import { CATEGORY_LABELS } from '@/lib/i18n/messages';
import {
  messageForSushiLimitError,
  MENU_PAGE_MESSAGES,
} from '@/lib/i18n/menu-page-messages';
import {
  messageForSushiRoundError,
  SUSHI_ROUND_MESSAGES,
} from '@/lib/i18n/sushi-round-messages';
import { customerMenuPageBottomPaddingClass } from '@/lib/customer-menu-bottom-bar-layout';
import { customerMenuShellRootClass } from '@/lib/customer-menu-chrome-layout';
import { deriveMenuPageFooter } from '@/lib/menu-page-footer';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { coerceCartPrice, coerceCartQty } from '@/lib/cart-totals';
import { showToast } from '@/components/ui/Toast';
import { completeGuestOrderSubmit } from '@/lib/menu-order-submit-outcome';
import { scheduleMenuOrderPostSubmitEffects } from '@/lib/menu-order-post-submit';
import {
  appendFailureNeedsSessionRefresh,
  executeMenuOrderSubmit,
  resolveAppendClientRequestId,
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
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { CustomerMenuFooter } from '@/components/menu/CustomerMenuFooter';
import { CustomerMenuCatalogSkeleton } from '@/components/menu/CustomerMenuCatalogSkeleton';
import { CustomerOrderingIntroModal } from '@/components/menu/CustomerOrderingIntroModal';
import { CustomerGuestOrderingNotice } from '@/components/menu/CustomerGuestOrderingNotice';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useSubmitCooldownRemaining } from '@/lib/use-submit-cooldown-remaining';
import { customerOrderingAudience } from '@/lib/customer-ordering-audience';
import {
  getCustomerOrderingIntroCopy,
  type CustomerOrderingIntroCopy,
} from '@/lib/i18n/customer-ordering-intro-messages';
import { useCustomerOrderingIntro } from '@/lib/use-customer-ordering-intro';
import type { UILanguage } from '@/lib/i18n';
import { menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  guestCartHasLimitedSushiItems,
  previewGuestCartSushiGate,
  sessionGuestCountForLimits,
  sushiLimitHintParts,
} from '@/lib/sushi-buffet-limits';
import { normalizeBuffetServiceMode } from '@mesa/shared';
import {
  resolveGuestOrderingNoticeForDisplay,
} from '@/lib/guest-ordering-notice';
import type { MenuOrderingRestaurant } from '@/components/menu/MenuOrderingController';
import type { SushiRoundSettings } from '@/lib/table-order-round/settings';
import { isSushiRoundFreeMenuPrice } from '@/lib/table-order-round/settings';
import { isCooldownActive, isDeferCooldownActive } from '@/lib/table-order-round/status';
import { SushiRoundStickyBar } from '@/components/menu/sushi/SushiRoundStickyBar';
import { SushiRoundReviewDrawer } from '@/components/menu/sushi/SushiRoundReviewDrawer';
import { useTableOrderRound } from '@/lib/table-order-round/use-table-order-round';
import { buildOwnRoundReviewGroups } from '@/lib/table-order-round/own-review-lines';

type Props = {
  restaurant: MenuOrderingRestaurant;
  sushiRoundSettings: SushiRoundSettings;
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  catalogReady?: boolean;
  tableId: string;
  displayName: string;
  orderCooldownSeconds: number;
  initialSessionContext?: CustomerSessionContext | null;
  isDemo?: boolean;
};

export function SushiMenuPage({
  restaurant,
  sushiRoundSettings,
  menuItems,
  menuCategories,
  catalogReady = true,
  tableId,
  displayName,
  orderCooldownSeconds,
  initialSessionContext = null,
  isDemo,
}: Props) {
  const { lang } = useLanguage();
  const t = MENU_PAGE_MESSAGES[lang];
  const roundT = SUSHI_ROUND_MESSAGES[lang];
  const [activeTopCategory, setActiveTopCategory] = useState<string>('Pratos');
  const [activeSubpath, setActiveSubpath] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderedOpen, setOrderedOpen] = useState(false);
  const [roundReviewOpen, setRoundReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roundBusy, setRoundBusy] = useState(false);
  const submittingRef = useRef(false);
  const pendingAppendIntentRef = useRef<{ clientRequestId: string; fingerprint: string } | null>(
    null,
  );
  const {
    submitCooldownRemaining,
    isSubmitCooldownActive,
    restartSubmitCooldown,
  } = useSubmitCooldownRemaining(orderCooldownSeconds);

  const {
    activeSession,
    recentOrders,
    kitchenProgress,
    sessionResolved,
    refresh: refreshSessionContext,
    isSessionContextFresh,
  } = useCustomerSessionContext(initialSessionContext, {
    slug: restaurant.slug,
    tableId,
    isDemo,
    resumeScope: orderedOpen ? 'full' : 'gate',
  });

  const round = useTableOrderRound({
    slug: restaurant.slug,
    restaurantId: restaurant.id,
    tableId,
    sessionId: activeSession?.id ?? null,
    enabled: !isDemo && sessionResolved && !!activeSession,
    initialSettings: sushiRoundSettings,
  });

  const orderingAudience = useMemo(() => customerOrderingAudience(null), []);
  const { visible: introVisible, dismiss: dismissIntro } = useCustomerOrderingIntro({
    restaurantSlug: restaurant.slug,
    audience: orderingAudience,
    sessionResolved,
  });
  const introCopy = useMemo((): CustomerOrderingIntroCopy => {
    const base = getCustomerOrderingIntroCopy(lang as UILanguage);
    return {
      ...base,
      title: roundT.introTitle,
      subtitle: roundT.introSubtitle,
      cta: roundT.introCta,
      steps: [
        { title: roundT.introStep1Title, body: roundT.introStep1Body },
        { title: roundT.introStep2Title, body: roundT.introStep2Body },
        { title: roundT.introStep3Title, body: roundT.introStep3Body },
      ],
    };
  }, [lang, roundT]);

  const ensureGuestCanPlaceOrder = useCallback(async () => {
    if (!sessionResolved) {
      const data = await refreshSessionContext('gate');
      return guestOrderGateFromSessionContext(data);
    }
    const cached = guestOrderGateFromCachedState(isDemo ?? false, activeSession);
    if (cached) return cached;
    const data = await refreshSessionContext('gate');
    return guestOrderGateFromSessionContext(data);
  }, [activeSession, isDemo, refreshSessionContext, sessionResolved]);

  const topCategories = menuCategories
    .filter((c) => !c.parent_id && c.active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const currentTop = topCategories.some((c) => c.id === activeTopCategory)
    ? activeTopCategory
    : topCategories[0]?.id || '';
  const subCategories = menuCategories
    .filter((c) => c.parent_id === currentTop && c.active)
    .sort((a, b) => a.sort_order - b.sort_order);
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
      return collectDescendantIds(currentSubpath).has(item.category_id);
    }
    if (item.category_id === currentTop) return true;
    return collectDescendantIds(currentTop).has(item.category_id);
  });

  const menuItemCodeById = useMemo(() => menuItemCodeLookupFromRows(menuItems), [menuItems]);
  const guestCanOrder = useMemo(
    () => sessionResolved && guestOrderingEnabled(activeSession),
    [activeSession, sessionResolved],
  );
  const guestOrderingHints = useMemo(() => {
    if (activeSession?.status === 'billing') {
      return { banner: t.billDisabledHint, action: t.billDisabledHint };
    }
    return { banner: t.waitingForBuffet, action: t.buffetRequired };
  }, [activeSession?.status, t]);

  const buffetServiceMode = normalizeBuffetServiceMode(restaurant.buffet_service_mode);
  const basketLocked = round.snapshot.round?.status === 'pending_confirm';

  const commitCartQty = useCallback((item: MenuItem, nextQty: number) => {
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      setCart((prev) => prev.filter((c) => c.menuItemId !== item.id));
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (!existing) {
        return [
          ...prev,
          {
            menuItemId: item.id,
            name_pt: item.name_pt,
            name_en: item.name_en,
            name_zh: item.name_zh,
            price: coerceCartPrice(item.price),
            emoji: item.emoji,
            qty: nextQty,
            note: '',
            notePresetKeys: item.note_preset_keys || [],
          },
        ];
      }
      return prev.map((c) => (c.menuItemId === item.id ? { ...c, qty: nextQty } : c));
    });
  }, []);

  const requestQtyChange = useCallback(
    async (menuItemId: string, rawNextQty: number) => {
      if (!catalogReady) return;
      const item = menuItems.find((m) => m.id === menuItemId);
      if (!item) return;

      const gate = await ensureGuestCanPlaceOrder();
      if (!gate.canPlace) {
        showToast(guestOrderingActionHint(lang, gate.sessionStatus), 'info');
        return;
      }

      let nextQty = Number(rawNextQty);
      if (!Number.isFinite(nextQty) || nextQty <= 0) nextQty = 0;

      if (isSushiRoundFreeMenuPrice(item.price)) {
        const status = round.snapshot.round?.status;
        if (
          status === 'cooldown' &&
          isCooldownActive(status, round.snapshot.round?.cooldown_until ?? null)
        ) {
          showToast(roundT.cooldownActive, 'info');
          return;
        }
      }

      if (nextQty > APPEND_CART_QTY_MAX) nextQty = APPEND_CART_QTY_MAX;
      commitCartQty(item, nextQty);
    },
    [
      catalogReady,
      commitCartQty,
      ensureGuestCanPlaceOrder,
      lang,
      menuItems,
      round.snapshot.round?.cooldown_until,
      round.snapshot.round?.status,
      roundT,
    ],
  );

  const bumpItem = (item: MenuItem, delta: number) => {
    const current = coerceCartQty(cart.find((c) => c.menuItemId === item.id)?.qty);
    void requestQtyChange(item.id, current + delta);
  };

  const updateNote = (menuItemId: string, note: string) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItemId === menuItemId ? { ...c, note } : c)),
    );
  };

  const footer = useMemo(
    () =>
      deriveMenuPageFooter({
        cart,
        recentOrders,
        activeSession,
        sessionResolved,
        staffAssisted: null,
        restaurantSlug: restaurant.slug,
        tableId,
        roundOwnQty: round.ownReviewQty,
      }),
    [activeSession, cart, recentOrders, restaurant.slug, round.ownReviewQty, sessionResolved, tableId],
  );

  const roundStatus = round.snapshot.round?.status;
  const inTableCooldown =
    roundStatus === 'cooldown' &&
    isCooldownActive(roundStatus, round.snapshot.round?.cooldown_until ?? null);
  const canSendRound =
    round.ownReviewQty > 0 &&
    (roundStatus === 'collecting' || roundStatus == null) &&
    !inTableCooldown &&
    !isDeferCooldownActive(round.snapshot.round?.defer_cooldown_until ?? null);
  const pageBottomPaddingClass = customerMenuPageBottomPaddingClass(footer.visible);
  const guestNotice = useMemo(
    () => resolveGuestOrderingNoticeForDisplay(restaurant.guest_ordering_notice, lang),
    [lang, restaurant.guest_ordering_notice],
  );
  const hideGuestNoticeChrome = isDemo || cartOpen || orderedOpen || roundReviewOpen || introVisible;

  const roundReviewGroups = useMemo(
    () =>
      buildOwnRoundReviewGroups({
        lines: round.snapshot.lines,
        guestClientId: round.guestClientId,
        menuItems,
        lang,
      }),
    [lang, menuItems, round.guestClientId, round.snapshot.lines],
  );

  const formatCountLabel = useCallback(
    (template: string, count: number) => template.replace('{count}', String(count)),
    [],
  );

  const clearSubmitCart = useCallback(() => {
    setCart([]);
    setCartOpen(false);
  }, []);

  const resolveLimitItem = useCallback(
    (id: string) => {
      const item = menuItems.find((m) => m.id === id);
      if (!item) return null;
      return {
        per_person_qty_limit: item.per_person_qty_limit,
        over_limit_unit_price: item.over_limit_unit_price,
        price: item.price,
      };
    },
    [menuItems],
  );

  useEffect(() => {
    if (isDemo) return;
    warmCustomerGeoForOrder({ restaurant, isWaiterFlow: false });
  }, [isDemo, restaurant]);

  const isLocalDevHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

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
          await refreshSessionContext('gate');
          showToast(t.billDisabledHint, 'info');
          return;
        }
        if (failure.code === 'location_too_far') showToast(t.locationTooFar, 'error');
        else if (failure.code === 'location_required') showToast(t.locationPermissionDenied, 'error');
        else if (failure.code === 'buffet_required') showToast(t.buffetRequired, 'info');
        else if (
          failure.code === 'per_person_limit_exceeded' ||
          failure.code === 'limited_item_requires_headcount'
        ) {
          showToast(messageForSushiLimitError(failure.code, t), 'info');
        } else if (failure.code === 'rate_limited') showToast(t.submitRateLimited, 'error');
        else if (failure.code === 'sushi_round_required') showToast(roundT.basketLocked, 'info');
        else showToast(t.submitFailed, 'error');
        return;
      }
      showToast(t.submitFailed, 'error');
    },
    [lang, refreshSessionContext, roundT.basketLocked, t],
  );

  const submitCart = async () => {
    if (!catalogReady || cart.length === 0 || isSubmitCooldownActive) return;
    if (submittingRef.current) return;

    if (isDemo) {
      restartSubmitCooldown();
      setCart([]);
      setCartOpen(false);
      showToast(t.orderSuccess, 'success');
      return;
    }

    const freeCart = cart.filter((c) => isSushiRoundFreeMenuPrice(c.price));
    const paidCart = cart.filter((c) => !isSushiRoundFreeMenuPrice(c.price));

    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (freeCart.length > 0) {
        const result = await round.commitCartLines(
          freeCart.map((c) => ({
            menuItemId: c.menuItemId,
            qty: coerceCartQty(c.qty),
            note: c.note || '',
          })),
        );
        if (!result.ok) {
          showToast(messageForSushiRoundError(result.error, roundT), 'info');
          return;
        }
        setCart(paidCart);
        if (paidCart.length > 0) {
          showToast(roundT.placedInRound, 'success');
        }
      }

      if (paidCart.length === 0) {
        restartSubmitCooldown();
        clearSubmitCart();
        setRoundReviewOpen(true);
        showToast(roundT.placedInRound, 'success');
        return;
      }

      const cartQtyRows = paidCart.map((c) => ({
        menuItemId: c.menuItemId,
        qty: coerceCartQty(c.qty),
      }));
      let sessionOrders = recentOrders;
      const needsOrders = guestCartHasLimitedSushiItems({
        serviceMode: buffetServiceMode,
        cart: cartQtyRows,
        resolveItem: resolveLimitItem,
      });
      if (needsOrders && !isSessionContextFresh()) {
        const fresh = await refreshSessionContext('full');
        sessionOrders = fresh?.recent_orders ?? recentOrders;
      }
      const sushiGate = previewGuestCartSushiGate({
        serviceMode: buffetServiceMode,
        guestCount: sessionGuestCountForLimits(sessionOrders),
        sessionOrders,
        cart: cartQtyRows,
        resolveItem: resolveLimitItem,
      });
      if (!sushiGate.ok) {
        showToast(messageForSushiLimitError(sushiGate.error, t), 'info');
        return;
      }

      const intent = resolveAppendClientRequestId({
        cart: paidCart,
        previous: pendingAppendIntentRef.current,
      });
      pendingAppendIntentRef.current = {
        clientRequestId: intent.clientRequestId,
        fingerprint: intent.fingerprint,
      };

      const result = await executeMenuOrderSubmit({
        flow: 'guest',
        cart: paidCart,
        slug: restaurant.slug,
        tableId,
        waiterFlow: false,
        clientRequestId: intent.clientRequestId,
        ensureGate: ensureGuestCanPlaceOrder,
        resolveGeo: () =>
          resolveCustomerGeoForOrder({
            restaurant,
            isWaiterFlow: false,
            isLocalDevHost,
          }),
      });

      if ('kind' in result) {
        await showSubmitFailure(result);
        return;
      }

      pendingAppendIntentRef.current = null;
      scheduleMenuOrderPostSubmitEffects({
        slug: restaurant.slug,
        orderId: result.orderId,
        batchId: result.batchId,
        enqueueToken: result.enqueueToken,
        waiterFlow: false,
        lang,
        sessionId: result.sessionId,
        clientRequestId: result.clientRequestId,
        refreshSession: () => refreshSessionContext('full'),
      });
      restartSubmitCooldown();
      completeGuestOrderSubmit({
        orderSuccessMessage: t.orderSuccess,
        clearCart: clearSubmitCart,
      });
    } catch {
      showToast(t.submitFailed, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleFinalizeSuccess = useCallback(
    (data: {
      order_id?: string;
      batch_id?: string;
      enqueue_token?: string;
    }) => {
      if (!data.order_id || !data.enqueue_token) return;
      scheduleMenuOrderPostSubmitEffects({
        slug: restaurant.slug,
        orderId: data.order_id,
        batchId: data.batch_id || data.order_id,
        enqueueToken: data.enqueue_token,
        waiterFlow: false,
        lang,
        sessionId: activeSession?.id,
        refreshSession: () => refreshSessionContext('full'),
      });
      showToast(roundT.sentToast, 'success');
    },
    [activeSession?.id, lang, refreshSessionContext, restaurant.slug, roundT.sentToast],
  );

  const handleSendRound = async () => {
    if (roundBusy || !canSendRound) return;
    setRoundBusy(true);
    try {
      const geo = await resolveCustomerGeoForOrder({
        restaurant,
        isWaiterFlow: false,
        isLocalDevHost,
      });
      if (!geo.ok) {
        if (geo.reason === 'too_far') showToast(t.locationTooFar, 'error');
        else if (geo.reason === 'permission_denied') showToast(t.locationPermissionDenied, 'error');
        else if (geo.reason === 'not_supported') showToast(t.locationNotSupported, 'error');
        else showToast(t.locationCheckFailed, 'error');
        return;
      }
      const result = await round.submitRequest({
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
      if (!result.ok) {
        showToast(messageForSushiRoundError(result.error, roundT), 'info');
        return;
      }
      setRoundReviewOpen(false);
    } finally {
      setRoundBusy(false);
    }
  };

  const handleConfirmVote = async () => {
    setRoundBusy(true);
    try {
      const result = await round.vote('confirm');
      if (!result.ok) {
        showToast(messageForSushiRoundError(result.error, roundT), 'info');
        return;
      }
      round.setConfirmModalOpen(false);
    } finally {
      setRoundBusy(false);
    }
  };

  const handleDeferVote = async () => {
    setRoundBusy(true);
    try {
      const result = await round.vote('defer');
      if (!result.ok) {
        showToast(messageForSushiRoundError(result.error, roundT), 'info');
        return;
      }
      showToast(roundT.deferredToast, 'info');
      round.setDeferModalOpen(false);
      round.setConfirmModalOpen(false);
    } finally {
      setRoundBusy(false);
    }
  };

  const seenKitchenSendRef = useRef<string | null>(null);
  useEffect(() => {
    const sent = round.lastKitchenSend;
    if (!sent || seenKitchenSendRef.current === sent.order_id) return;
    seenKitchenSendRef.current = sent.order_id;
    handleFinalizeSuccess(sent);
    setRoundReviewOpen(false);
  }, [handleFinalizeSuccess, round.lastKitchenSend]);

  const rootClassName = `min-h-screen bg-brand-bg relative ${customerMenuShellRootClass} ${pageBottomPaddingClass}`;

  return (
    <div className={rootClassName}>
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        sticky
        backLink={null}
      >
        <div className="mesa-chip-scroll flex gap-0 px-4 pb-3">
          {topCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveTopCategory(cat.id);
                setActiveSubpath('');
              }}
              className={`flex-shrink-0 px-4 py-2.5 ${CUSTOMER_MENU_TYPE.categoryTop} transition-all border-b-2 ${
                currentTop === cat.id
                  ? `border-brand-gold text-brand-gold ${CUSTOMER_MENU_TYPE.categoryTopActive}`
                  : 'border-transparent text-brand-text-muted'
              }`}
            >
              {localizedCategoryLabel(cat)}
            </button>
          ))}
        </div>
        {subCategories.length > 0 ? (
          <div className="mesa-chip-scroll flex gap-2 px-4 pb-3">
            <button
              type="button"
              onClick={() => setActiveSubpath('')}
              className={`flex-shrink-0 px-3 py-2 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
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
                type="button"
                onClick={() => setActiveSubpath(subpath.id)}
                className={`flex-shrink-0 px-3 py-2 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
                  currentSubpath === subpath.id
                    ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                    : 'border-brand-border text-brand-text-muted'
                }`}
              >
                {localizedCategoryLabel(subpath)}
              </button>
            ))}
          </div>
        ) : null}
      </CustomerOrderingHeader>

      {!isDemo ? <SushiRoundStickyBar snapshot={round.snapshot} labels={roundT} /> : null}

      {!isDemo && sessionResolved && !guestCanOrder ? (
        <div className="mx-4 mt-3 rounded-xl border border-brand-ink/35 bg-brand-ink/10 px-4 py-3 text-[13px] text-brand-text">
          {guestOrderingHints.banner}
        </div>
      ) : null}

      <div className="px-4 py-4">
        {!catalogReady ? (
          <CustomerMenuCatalogSkeleton />
        ) : currentItems.length === 0 ? (
          <p className="text-center text-brand-text-muted py-12 text-sm">{t.noItems}</p>
        ) : (
          <div className="space-y-3">
            {currentItems.map((item) => {
              const cartQty = coerceCartQty(cart.find((c) => c.menuItemId === item.id)?.qty);
              const hintParts = sushiLimitHintParts(buffetServiceMode, item);
              const limitHint = hintParts
                ? t.sushiLimitHint
                    .replace('{perPerson}', String(hintParts.perPerson))
                    .replace('{price}', hintParts.overLimitPrice.toFixed(2))
                : null;
              return (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  lang={lang}
                  cartQty={cartQty}
                  limitHint={limitHint}
                  onIncrement={() => bumpItem(item, 1)}
                  onDecrement={() => bumpItem(item, -1)}
                />
              );
            })}
          </div>
        )}
      </div>

      <CustomerMenuFooter
        {...footer}
        labels={{
          viewCart: t.viewCart,
          viewBill: t.viewBillLink,
          viewOrdered: t.viewOrdered,
          viewRoundReview: roundT.viewRoundReview,
          roundReviewCount: (count) => formatCountLabel(roundT.roundReviewCount, count),
          placeOrder: t.placeOrder,
          orderedCount: (count) => formatCountLabel(t.orderedCount, count),
          footerTotal: t.footerTotal,
        }}
        onOpenCart={() => {
          setOrderedOpen(false);
          setRoundReviewOpen(false);
          setCartOpen(true);
        }}
        onOpenOrdered={() => {
          setCartOpen(false);
          setRoundReviewOpen(false);
          setOrderedOpen(true);
          if (!isDemo) void refreshSessionContext('full');
        }}
        onOpenRoundReview={() => {
          setCartOpen(false);
          setOrderedOpen(false);
          setRoundReviewOpen(true);
        }}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        menuItemCodeById={menuItemCodeById}
        lang={lang}
        onClose={() => setCartOpen(false)}
        onUpdateQty={(id, qty) => {
          void requestQtyChange(id, qty);
        }}
        onUpdateNote={updateNote}
        onSubmit={submitCart}
        submitting={submitting}
        submitCooldownRemaining={submitCooldownRemaining}
      />

      <SushiRoundReviewDrawer
        open={roundReviewOpen}
        groups={roundReviewGroups}
        labels={{
          title: roundT.reviewTitle,
          empty: roundT.reviewEmpty,
          continueOrdering: t.continueOrdering,
          sendRound: roundT.sendRound,
          lockedHint: roundT.basketLocked,
        }}
        canSend={canSendRound}
        sendBusy={roundBusy}
        locked={basketLocked}
        onClose={() => setRoundReviewOpen(false)}
        onSend={() => void handleSendRound()}
      />

      <OrderedDrawer
        open={orderedOpen}
        orders={recentOrders}
        lang={lang}
        sessionResolved={sessionResolved}
        kitchenProgress={kitchenProgress}
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
        onClose={() => setOrderedOpen(false)}
      />

      <ConfirmModal
        open={round.confirmModalOpen && !round.deferModalOpen}
        onClose={() => {
          round.setConfirmModalOpen(false);
          round.setDeferModalOpen(true);
        }}
        title={roundT.confirmTitle}
        message={roundT.confirmMessage}
        confirmLabel={roundT.confirmAction}
        cancelLabel={roundT.deferAction}
        onConfirm={() => void handleConfirmVote()}
        confirming={roundBusy}
      />

      <ConfirmModal
        open={round.deferModalOpen}
        onClose={() => round.setDeferModalOpen(false)}
        title={roundT.deferConfirmTitle}
        message={roundT.deferConfirmMessage}
        confirmLabel={roundT.deferConfirmYes}
        cancelLabel={roundT.deferConfirmNo}
        onConfirm={() => void handleDeferVote()}
        confirming={roundBusy}
      />

      <CustomerOrderingIntroModal
        open={introVisible}
        lang={lang}
        copy={introCopy}
        onDismiss={dismissIntro}
        showSplitPreview={false}
      />

      {guestNotice ? (
        <CustomerGuestOrderingNotice
          restaurantId={restaurant.id}
          notice={guestNotice}
          lang={lang}
          hidden={hideGuestNoticeChrome}
        />
      ) : null}
    </div>
  );
}
