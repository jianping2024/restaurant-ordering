'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { APPEND_CART_QTY_MAX, clampAppendCartNote, type MenuItem, type CartItem, type MenuCategory } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { CartDrawer } from './CartDrawer';
import { OrderedDrawer } from './OrderedDrawer';
import { CustomerMenuItemDetailSheet } from './CustomerMenuItemDetailSheet';
import {
  formatStaffOverageMessage,
  formatStaffSubmitOverageMessage,
  messageForSushiLimitError,
  MENU_PAGE_MESSAGES,
} from '@/lib/i18n/menu-page-messages';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { customerMenuPageBottomPaddingClass } from '@/lib/customer-menu-bottom-bar-layout';
import { customerMenuShellRootClass } from '@/lib/customer-menu-chrome-layout';
import { CUSTOMER_MENU_ITEM_LIST_CLASS } from '@/lib/menu-item-card-layout';
import {
  customerMenuStripTopCategories,
  resolveCustomerMenuCatalogView,
} from '@/lib/menu-recommended';
import { deriveMenuPageFooter } from '@/lib/menu-page-footer';
import { getMenuCategoryLabel } from '@/lib/menu-admin';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { coerceCartPrice, coerceCartQty } from '@/lib/cart-totals';
import { showToast } from '@/components/ui/Toast';
import {
  completeGuestOrderSubmit,
  completeStaffAssistedOrderSubmit,
  completeStaffOverlayOrderSubmit,
} from '@/lib/menu-order-submit-outcome';
import type { MenuOrderSubmitSuccess } from '@/lib/menu-order-submit';
import { scheduleMenuOrderPostSubmitEffects } from '@/lib/menu-order-post-submit';
import {
  appendFailureNeedsSessionRefresh,
  appendCartFingerprint,
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
  guestOrderingBannerHint,
} from '@/lib/customer-menu-order-gate';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import { useCustomerSessionContext } from '@/lib/use-customer-session-context';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { CustomerMenuCategoryStrip } from '@/components/menu/CustomerMenuCategoryStrip';
import { CustomerMenuOrderGateBanner } from '@/components/menu/CustomerMenuOrderGateBanner';
import { staffAssistedReturnLabel } from '@/lib/i18n/staff-assisted-messages';
import { CustomerMenuFooter } from '@/components/menu/CustomerMenuFooter';
import { CustomerMenuCatalogSkeleton } from '@/components/menu/CustomerMenuCatalogSkeleton';
import { CustomerOrderingIntroModal } from '@/components/menu/CustomerOrderingIntroModal';
import { CustomerGuestOrderingNotice } from '@/components/menu/CustomerGuestOrderingNotice';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useSubmitCooldownRemaining } from '@/lib/use-submit-cooldown-remaining';
import { customerOrderingAudience } from '@/lib/customer-ordering-audience';
import { getCustomerOrderingIntroCopy } from '@/lib/i18n/customer-ordering-intro-messages';
import { useCustomerOrderingIntro } from '@/lib/use-customer-ordering-intro';
import { menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import {
  classifyStaffQtyIncrease,
  guestCartHasLimitedSushiItems,
  previewGuestCartSushiGate,
  previewStaffCartOverage,
  sessionGuestCountForLimits,
  sessionOrderedQtyForMenuItem,
  sushiLimitHintParts,
} from '@/lib/sushi-buffet-limits';
import { normalizeBuffetServiceMode } from '@mesa/shared';
import type { BuffetServiceMode } from '@mesa/shared';
import {
  resolveGuestOrderingNoticeForDisplay,
  type GuestOrderingNotice,
} from '@/lib/guest-ordering-notice';

type StaffOverageDialog =
  | {
      kind: 'first_cross';
      menuItemId: string;
      nextQty: number;
      title: string;
      message: string;
    }
  | {
      kind: 'submit';
      cartFingerprint: string;
      title: string;
      message: string;
    };

export type MenuOrderingRestaurant = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  order_radius_meters?: number | null;
  feature_flags?: Record<string, boolean> | null;
  order_cooldown_seconds?: number | null;
  buffet_service_mode?: BuffetServiceMode | string | null;
  guest_ordering_notice?: GuestOrderingNotice | null;
  sushi_round_ordering_enabled?: boolean | null;
  sushi_per_person_per_round_cap?: number | null;
  sushi_round_confirm_timeout_seconds?: number | null;
  sushi_round_cooldown_seconds?: number | null;
  sushi_round_defer_cooldown_seconds?: number | null;
};

export type MenuOrderingPresentationMode = 'page' | 'embedded';
export type StaffSubmitMode = 'navigate' | 'overlay';

interface Props {
  restaurant: MenuOrderingRestaurant;
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  recommendedItemIds?: string[];
  /** When false, catalog is loading — block ordering until ready. Default true (embedded/demo). */
  catalogReady?: boolean;
  tableId: string;
  displayName: string;
  orderCooldownSeconds: number;
  initialSessionContext?: CustomerSessionContext | null;
  isDemo?: boolean;
  staffAssisted?: StaffAssistedFlow | null;
  presentationMode?: MenuOrderingPresentationMode;
  staffSubmitMode?: StaffSubmitMode;
  initialCart?: CartItem[];
  onCartDraftChange?: (cart: CartItem[]) => void;
  onStaffAppendSuccess?: (result: MenuOrderSubmitSuccess, cart: CartItem[]) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export function MenuOrderingController({
  restaurant,
  menuItems,
  menuCategories,
  recommendedItemIds = [],
  catalogReady = true,
  tableId,
  displayName,
  orderCooldownSeconds,
  initialSessionContext = null,
  isDemo,
  staffAssisted = null,
  presentationMode = 'page',
  staffSubmitMode = 'navigate',
  initialCart,
  onCartDraftChange,
  onStaffAppendSuccess,
  onSubmittingChange,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const isEmbedded = presentationMode === 'embedded';
  const [activeTopCategory, setActiveTopCategory] = useState<string>('Pratos');
  const [activeSubpath, setActiveSubpath] = useState<string>('');
  const [cart, setCartState] = useState<CartItem[]>(initialCart ?? []);
  const setCartTracked = useCallback(
    (value: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
      setCartState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        onCartDraftChange?.(next);
        return next;
      });
    },
    [onCartDraftChange],
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [orderedOpen, setOrderedOpen] = useState(false);
  const [detailMenuItemId, setDetailMenuItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [staffOverageDialog, setStaffOverageDialog] = useState<StaffOverageDialog | null>(null);
  const submittingRef = useRef(false);
  const pendingAppendIntentRef = useRef<{ clientRequestId: string; fingerprint: string } | null>(
    null,
  );
  const [demoToast, setDemoToast] = useState(false);
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

  const orderingAudience = useMemo(
    () => customerOrderingAudience(staffAssisted),
    [staffAssisted],
  );
  const { visible: introVisible, dismiss: dismissIntro } = useCustomerOrderingIntro({
    restaurantSlug: restaurant.slug,
    audience: orderingAudience,
    sessionResolved,
  });
  const introCopy = getCustomerOrderingIntroCopy(lang);

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

  // 当前分类菜品（含虚拟「推荐」）
  const catalogView = useMemo(
    () =>
      resolveCustomerMenuCatalogView({
        menuCategories,
        menuItems,
        recommendedItemIds,
        activeTopId: activeTopCategory,
        activeSubpath,
      }),
    [menuCategories, menuItems, recommendedItemIds, activeTopCategory, activeSubpath],
  );
  const currentTop = catalogView.currentTopId;
  const subCategories = catalogView.subCategories;
  const currentSubpath = catalogView.currentSubpath;
  const currentItems = catalogView.currentItems;

  const menuItemCodeById = useMemo(
    () => menuItemCodeLookupFromRows(menuItems),
    [menuItems],
  );

  const guestCanOrder = useMemo(
    () => sessionResolved && guestOrderingEnabled(activeSession),
    [activeSession, sessionResolved],
  );

  const buffetServiceMode = normalizeBuffetServiceMode(restaurant.buffet_service_mode);
  const limitGuestCount = sessionGuestCountForLimits(recentOrders);
  const staffAssistedOrdering = !!staffAssisted;

  /** Write cart qty after gates (list + drawer share this). */
  const commitCartQty = useCallback(
    (item: MenuItem, nextQty: number) => {
      if (!Number.isFinite(nextQty) || nextQty <= 0) {
        setCartTracked((prev) => prev.filter((c) => c.menuItemId !== item.id));
        return;
      }
      setCartTracked((prev) => {
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
    },
    [setCartTracked],
  );

  /**
   * Single qty-change path for list steppers and cart drawer.
   * Staff sushi: confirm on first free→overage cross; toast on further overage +.
   */
  const requestCartQtyChange = useCallback(
    async (menuItemId: string, rawNextQty: number) => {
      if (!catalogReady) return;
      const item = menuItems.find((m) => m.id === menuItemId);
      if (!item) return;

      const gate = await ensureGuestCanPlaceOrder();
      if (!gate.canPlace) {
        showToast(guestOrderingActionHint(lang, gate.sessionStatus), 'info');
        return;
      }

      const current = coerceCartQty(cart.find((c) => c.menuItemId === menuItemId)?.qty);
      let nextQty = Number(rawNextQty);
      if (!Number.isFinite(nextQty) || nextQty <= 0) {
        commitCartQty(item, 0);
        return;
      }

      if (!staffAssistedOrdering) {
        // Guest sushi limits are submit gates (fresh session + server), not list disables.
        if (nextQty > APPEND_CART_QTY_MAX) {
          nextQty = APPEND_CART_QTY_MAX;
          if (nextQty <= current) return;
        }
        commitCartQty(item, nextQty);
        return;
      }

      if (nextQty > current) {
        const decision = classifyStaffQtyIncrease({
          serviceMode: buffetServiceMode,
          item,
          guestCount: limitGuestCount,
          alreadyOrdered: sessionOrderedQtyForMenuItem(recentOrders, item.id),
          fromQty: current,
          toQty: nextQty,
        });
        if (decision.action === 'block_headcount') {
          showToast(messageForSushiLimitError('limited_item_requires_headcount', MENU_PAGE_MESSAGES[lang]), 'info');
          return;
        }
        if (decision.action === 'confirm_first_cross') {
          const messages = MENU_PAGE_MESSAGES[lang];
          setStaffOverageDialog({
            kind: 'first_cross',
            menuItemId: item.id,
            nextQty,
            title: messages.staffOverageConfirmTitle,
            message: formatStaffOverageMessage(messages.staffOverageFirstCrossMessage, {
              name: resolveMenuItemLocalizedName(item, lang),
              qty: decision.overageQtyAdded,
              price: decision.overLimitUnitPrice,
            }),
          });
          return;
        }
        if (decision.action === 'toast_more_overage') {
          showToast(
            formatStaffOverageMessage(MENU_PAGE_MESSAGES[lang].staffOverageMoreToast, {
              name: resolveMenuItemLocalizedName(item, lang),
              qty: decision.overageQtyAdded,
              price: decision.overLimitUnitPrice,
            }),
            'info',
          );
        }
      }

      commitCartQty(item, nextQty);
    },
    [
      buffetServiceMode,
      cart,
      catalogReady,
      commitCartQty,
      ensureGuestCanPlaceOrder,
      lang,
      limitGuestCount,
      menuItems,
      recentOrders,
      staffAssistedOrdering,
    ],
  );

  const bumpCartItem = (item: MenuItem, delta: number) => {
    const current = coerceCartQty(cart.find((c) => c.menuItemId === item.id)?.qty);
    void requestCartQtyChange(item.id, current + delta);
  };

  const treatZeroAsFree = buffetServiceMode === 'sushi';
  const detailItem = useMemo(
    () => (detailMenuItemId ? menuItems.find((m) => m.id === detailMenuItemId) ?? null : null),
    [detailMenuItemId, menuItems],
  );
  const detailCartQty = coerceCartQty(
    detailItem ? cart.find((c) => c.menuItemId === detailItem.id)?.qty : 0,
  );

  // 更新备注
  const updateNote = (menuItemId: string, note: string) => {
    setCartTracked((prev) =>
      prev.map((c) => (c.menuItemId === menuItemId ? { ...c, note: clampAppendCartNote(note) } : c)),
    );
  };

  const t = MENU_PAGE_MESSAGES[lang];
  const detailLimitHint = useMemo(() => {
    if (!detailItem) return null;
    const hintParts = sushiLimitHintParts(buffetServiceMode, detailItem);
    if (!hintParts) return null;
    return t.sushiLimitHint
      .replace('{perPerson}', String(hintParts.perPerson))
      .replace('{price}', hintParts.overLimitPrice.toFixed(2));
  }, [buffetServiceMode, detailItem, t.sushiLimitHint]);
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
  const guestNotice = useMemo(
    () => resolveGuestOrderingNoticeForDisplay(restaurant.guest_ordering_notice, lang),
    [lang, restaurant.guest_ordering_notice],
  );
  const hideGuestNoticeChrome =
    isDemo ||
    isEmbedded ||
    staffAssisted !== null ||
    cartOpen ||
    orderedOpen ||
    introVisible;

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
    if (!isDemo) void refreshSessionContext('full');
  }, [isDemo, refreshSessionContext]);

  const closeCartDrawer = useCallback(() => setCartOpen(false), []);
  const closeOrderedDrawer = useCallback(() => setOrderedOpen(false), []);

  const clearSubmitCart = useCallback(() => {
    setCartTracked([]);
    setCartOpen(false);
  }, [setCartTracked]);

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

  const completeStaffOverlaySubmit = useCallback(
    (result: MenuOrderSubmitSuccess, submittedCart: CartItem[]) => {
      onStaffAppendSuccess?.(result, submittedCart);
      completeStaffOverlayOrderSubmit({ clearCart: clearSubmitCart });
      showToast(t.orderSuccess, 'success');
    },
    [clearSubmitCart, onStaffAppendSuccess, t.orderSuccess],
  );

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
    if (!staffAssisted || staffSubmitMode !== 'navigate') return;
    router.prefetch(staffAssisted.returnHref);
  }, [router, staffAssisted, staffSubmitMode]);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [onSubmittingChange, submitting]);

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
        }
        else if (failure.code === 'rate_limited') showToast(t.submitRateLimited, 'error');
        else showToast(t.submitFailed, 'error');
        return;
      }
      showToast(t.submitFailed, 'error');
    },
    [lang, refreshSessionContext, t],
  );

  // 提交订单：员工超额先汇总确认，再走 performSubmit（确认前不 arming 请求）
  const performSubmit = async () => {
    if (!catalogReady || cart.length === 0 || isSubmitCooldownActive) return;
    if (submittingRef.current) return;

    if (isDemo) {
      const gate = await ensureGuestCanPlaceOrder();
      if (!gate.canPlace) {
        showToast(guestOrderingActionHint(lang, gate.sessionStatus), 'info');
        return;
      }
      if (staffAssisted) {
        if (staffSubmitMode === 'overlay') {
          completeStaffOverlaySubmit(
            {
              flow: 'staff_assisted',
              orderId: 'demo-order',
              batchId: 'demo-batch',
              enqueueToken: 'demo-token',
              clientRequestId: 'demo-client-request',
              idempotentReplay: false,
            },
            cart,
          );
        } else {
          completeStaffAssistedSubmit();
        }
        return;
      }
      restartSubmitCooldown();
      setCartTracked([]);
      setCartOpen(false);
      setDemoToast(true);
      setTimeout(() => setDemoToast(false), 3500);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const cartQtyRows = cart.map((c) => ({
        menuItemId: c.menuItemId,
        qty: coerceCartQty(c.qty),
      }));

      // Guest sushi precheck under submitting spinner — one full refresh only when needed.
      if (!staffAssisted) {
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
      }

      const intent = resolveAppendClientRequestId({
        cart,
        previous: pendingAppendIntentRef.current,
      });
      pendingAppendIntentRef.current = {
        clientRequestId: intent.clientRequestId,
        fingerprint: intent.fingerprint,
      };

      const waiterFlow = !!staffAssisted;
      const result = await executeMenuOrderSubmit({
        flow: waiterFlow ? 'staff_assisted' : 'guest',
        cart,
        slug: restaurant.slug,
        tableId,
        waiterFlow,
        clientRequestId: intent.clientRequestId,
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

      pendingAppendIntentRef.current = null;

      scheduleMenuOrderPostSubmitEffects({
        slug: restaurant.slug,
        orderId: result.orderId,
        batchId: result.batchId,
        enqueueToken: result.enqueueToken,
        waiterFlow,
        lang,
        sessionId: result.sessionId,
        clientRequestId: result.clientRequestId,
        refreshSession: () => refreshSessionContext('full'),
      });

      restartSubmitCooldown();

      if (waiterFlow) {
        if (staffSubmitMode === 'overlay') {
          completeStaffOverlaySubmit(result, cart);
        } else {
          completeStaffAssistedSubmit();
        }
      } else {
        completeGuestSubmit();
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[MenuPage.submitOrder] failed:', error);
      }
      showToast(t.submitFailed, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const submitOrder = async () => {
    if (!catalogReady || cart.length === 0 || isSubmitCooldownActive) return;
    if (submittingRef.current) return;

    const cartQtyRows = cart.map((c) => ({
      menuItemId: c.menuItemId,
      qty: coerceCartQty(c.qty),
    }));

    if (staffAssistedOrdering) {
      const preview = previewStaffCartOverage({
        serviceMode: buffetServiceMode,
        guestCount: limitGuestCount,
        sessionOrders: recentOrders,
        cart: cartQtyRows,
        resolveItem: resolveLimitItem,
      });
      if (preview.status === 'blocked') {
        showToast(messageForSushiLimitError(preview.error, t), 'info');
        return;
      }
      if (preview.status === 'overage') {
        setStaffOverageDialog({
          kind: 'submit',
          cartFingerprint: appendCartFingerprint(cart),
          title: t.staffOverageSubmitTitle,
          message: formatStaffSubmitOverageMessage(
            preview.lines.map((line) => {
              const item = menuItems.find((m) => m.id === line.menuItemId);
              return {
                name: item ? resolveMenuItemLocalizedName(item, lang) : line.menuItemId,
                qty: line.overageQty,
                price: line.overLimitUnitPrice,
              };
            }),
            t,
          ),
        });
        return;
      }
    }

    await performSubmit();
  };

  const handleStaffOverageConfirm = async () => {
    const dialog = staffOverageDialog;
    if (!dialog) return;
    if (dialog.kind === 'first_cross') {
      const item = menuItems.find((m) => m.id === dialog.menuItemId);
      setStaffOverageDialog(null);
      if (item) commitCartQty(item, dialog.nextQty);
      return;
    }
    const fingerprint = appendCartFingerprint(cart);
    setStaffOverageDialog(null);
    if (fingerprint !== dialog.cartFingerprint) {
      await submitOrder();
      return;
    }
    await performSubmit();
  };

  const rootClassName = isEmbedded
    ? `flex min-h-0 flex-1 flex-col overflow-hidden bg-brand-bg relative ${pageBottomPaddingClass}`
    : `min-h-screen bg-brand-bg relative ${customerMenuShellRootClass} ${pageBottomPaddingClass}`;

  return (
    <div className={rootClassName}>
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
        backLink={
          staffAssisted && !isEmbedded
            ? {
                href: staffAssisted.returnHref,
                label: staffAssistedReturnLabel(staffAssisted, lang),
              }
            : null
        }
      >
        <CustomerMenuCategoryStrip
          topCategories={customerMenuStripTopCategories(
            catalogView,
            t.recommended,
            (cat) => getMenuCategoryLabel(cat, lang),
          )}
          activeTopId={currentTop}
          onSelectTop={(id) => {
            setActiveTopCategory(id);
            setActiveSubpath('');
          }}
          subCategories={subCategories.map((sub) => ({
            id: sub.id,
            label: getMenuCategoryLabel(sub, lang),
          }))}
          activeSubpath={currentSubpath}
          onSelectSubpath={setActiveSubpath}
          subcategoryAllLabel={t.subcategoryAll}
          categoryMoreLabel={t.categoryMore}
        />
      </CustomerOrderingHeader>

      {!isDemo && sessionResolved && !guestCanOrder ? (
        <CustomerMenuOrderGateBanner
          message={guestOrderingBannerHint(lang, activeSession?.status ?? null)}
        />
      ) : null}

      {/* 菜品列表 */}
      <div
        className={
          isEmbedded
            ? 'flex-1 overflow-y-auto px-4 py-4'
            : 'px-4 py-4'
        }
      >
        {!catalogReady ? (
          <CustomerMenuCatalogSkeleton />
        ) : currentItems.length === 0 ? (
          <p className="text-center text-brand-text-muted py-12 text-sm">{t.noItems}</p>
        ) : (
          <div className={CUSTOMER_MENU_ITEM_LIST_CLASS}>
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
                  treatZeroAsFree={treatZeroAsFree}
                  onOpenDetail={() => {
                    setCartOpen(false);
                    setOrderedOpen(false);
                    setDetailMenuItemId(item.id);
                  }}
                  onIncrement={() => bumpCartItem(item, 1)}
                  onDecrement={() => bumpCartItem(item, -1)}
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
          placeOrder: t.placeOrder,
          orderedCount: (count) => formatCountLabel(t.orderedCount, count),
          footerTotal: t.footerTotal,
        }}
        onOpenCart={openCartDrawer}
        onOpenOrdered={openOrderedDrawer}
      />

      <CustomerMenuItemDetailSheet
        open={!!detailItem}
        item={detailItem}
        lang={lang}
        cartQty={detailCartQty}
        treatZeroAsFree={treatZeroAsFree}
        limitHint={detailLimitHint}
        onClose={() => setDetailMenuItemId(null)}
        onIncrement={() => {
          if (detailItem) bumpCartItem(detailItem, 1);
        }}
        onDecrement={() => {
          if (detailItem) bumpCartItem(detailItem, -1);
        }}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        menuItemCodeById={menuItemCodeById}
        lang={lang}
        onClose={closeCartDrawer}
        onUpdateQty={(id, qty) => {
          void requestCartQtyChange(id, qty);
        }}
        onUpdateNote={updateNote}
        onSubmit={submitOrder}
        submitting={submitting}
        submitCooldownRemaining={submitCooldownRemaining}
      />

      <ConfirmModal
        open={!!staffOverageDialog}
        onClose={() => setStaffOverageDialog(null)}
        title={staffOverageDialog?.title ?? ''}
        message={staffOverageDialog?.message ?? ''}
        confirmLabel={t.staffOverageConfirm}
        cancelLabel={t.staffOverageCancel}
        onConfirm={handleStaffOverageConfirm}
        confirming={submitting}
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
        onClose={closeOrderedDrawer}
      />

      <CustomerOrderingIntroModal
        open={introVisible}
        lang={lang}
        copy={introCopy}
        onDismiss={dismissIntro}
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
