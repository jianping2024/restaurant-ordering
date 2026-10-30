'use client';

import { IndividualCheckoutNotice } from '@/components/menu/IndividualCheckoutNotice';
import { useIndividualCheckoutHold } from '@/lib/use-individual-checkout-hold';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APPEND_CART_QTY_MAX, clampAppendCartNote, type MenuItem, type CartItem, type MenuCategory } from '@/types';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { CustomerRecommendedRail } from '@/components/menu/CustomerRecommendedRail';
import { CartDrawer } from '@/components/menu/CartDrawer';
import { OrderedDrawer } from '@/components/menu/OrderedDrawer';
import {
  messageForSushiLimitError,
  MENU_PAGE_MESSAGES,
} from '@/lib/i18n/menu-page-messages';
import {
  messageForGuestRoundQtyPreview,
  messageForSushiRoundError,
  resolveSushiCartSubmitLabel,
  SUSHI_ROUND_MESSAGES,
} from '@/lib/i18n/sushi-round-messages';
import { customerMenuPageBottomPaddingClass } from '@/lib/customer-menu-bottom-bar-layout';
import {
  customerMenuContentHostClass,
  customerMenuDualPaneRootClass,
  customerMenuShellRootClass,
} from '@/lib/customer-menu-chrome-layout';
import {
  CUSTOMER_MENU_ITEM_LIST_CLASS,
} from '@/lib/menu-item-card-layout';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';
import { getMenuCategoryLabel } from '@/lib/menu-admin';
import {
  customerMenuNavTopCategories,
  resolveCustomerMenuCatalogView,
} from '@/lib/menu-recommended';
import type { MenuTimeSlot } from '@/lib/menu-time-slot';
import { useSessionMenuTimeSlotId } from '@/lib/use-session-menu-time-slot';
import {
  EMPTY_CUSTOMER_MENU_DIETARY_FILTER_PREFS,
  filterMenuItemsByDietaryPrefs,
  type CustomerMenuDietaryFilterPrefs,
} from '@/lib/customer-menu-dietary-filter';
import type { AllergenCode } from '@/lib/allergens';
import { deriveMenuPageFooter } from '@/lib/menu-page-footer';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { coerceCartQty } from '@/lib/cart-totals';
import { bumpCartAddFeedbackKeyIfIncreased } from '@/lib/customer-cart-add-feedback';
import { upsertCartItemQty } from '@/lib/customer-cart-lines';
import { showToast } from '@/components/ui/Toast';
import { completeGuestOrderSubmit } from '@/lib/menu-order-submit-outcome';
import { scheduleMenuOrderPostSubmitEffects } from '@/lib/menu-order-post-submit';
import {
  appendFailureNeedsSessionRefresh,
  cartItemWireNote,
  executeMenuOrderSubmit,
  resolveAppendClientRequestId,
  type MenuOrderSubmitFailure,
} from '@/lib/menu-order-submit';
import { toggleCartNotePresetSelection } from '@/lib/menu-note-presets';
import {
  resolveCustomerGeoForOrder,
  warmCustomerGeoForOrder,
} from '@/lib/customer-geo-order';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import {
  guestOrderGateFromCachedState,
  guestOrderGateFromSessionContext,
  withIndividualHold,
  guestOrderingActionHint,
  guestOrderingBannerHint,
} from '@/lib/customer-menu-order-gate';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import { useCustomerSessionContext } from '@/lib/use-customer-session-context';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { CustomerMenuCategoryNav } from '@/components/menu/CustomerMenuCategoryNav';
import {
  CustomerMenuStorefrontScroll,
  customerMenuCategoryScrollModeForStorefront,
} from '@/components/menu/CustomerMenuStorefrontScroll';
import { CustomerMenuOrderGateBanner } from '@/components/menu/CustomerMenuOrderGateBanner';
import { CustomerMenuFooter } from '@/components/menu/CustomerMenuFooter';
import { useCustomerMenuSubmitFeedback } from '@/lib/customer-menu-submit-feedback';
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
import {
  guestCartHasLimitedSushiItems,
  previewGuestCartSushiGate,
  sessionGuestCountForLimits,
  sushiLimitHintParts,
} from '@/lib/sushi-buffet-limits';
import {
  previewGuestRoundCartDraftGates,
  previewGuestRoundLineSetGates,
} from '@/lib/table-order-round/round-meal-limit';
import { normalizeBuffetServiceMode } from '@mesa/shared';
import {
  resolveGuestOrderingNoticeForDisplay,
} from '@/lib/guest-ordering-notice';
import type { MenuOrderingRestaurant } from '@/components/menu/MenuOrderingController';
import type { SushiRoundSettings } from '@/lib/table-order-round/settings';
import { isSushiRoundFreeMenuPrice } from '@/lib/table-order-round/settings';
import { isCooldownActive } from '@/lib/table-order-round/status';
import {
  isKitchenSendSuccessStatusTransition,
  kitchenSendSuccessDedupeKey,
} from '@/lib/table-order-round/kitchen-send-success-ui';
import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';
import { SushiRoundStickyBar } from '@/components/menu/sushi/SushiRoundStickyBar';
import { SushiSendGuidanceStrip } from '@/components/menu/sushi/SushiSendGuidance';
import { useSushiSendGuidance } from '@/lib/table-order-round/use-sushi-send-guidance';
import { SushiRoundReviewDrawer } from '@/components/menu/sushi/SushiRoundReviewDrawer';
import { CustomerMenuPeerFloats } from '@/components/menu/CustomerMenuPeerFloats';
import { CustomerMenuItemDetailSheet } from '@/components/menu/CustomerMenuItemDetailSheet';
import { useTableOrderRound } from '@/lib/table-order-round/use-table-order-round';
import {
  buildRoundPaidSentLines,
  buildTableRoundReviewGroups,
} from '@/lib/table-order-round/own-review-lines';
import { sushiFreeItemDisplayQty } from '@/lib/table-order-round/client-api';
import { customerTableSessionRealtimeEnabled } from '@/lib/customer-table-session-realtime-enabled';
import { CustomerTableSessionRealtimeLazy } from '@/components/menu/CustomerTableSessionRealtimeLazy';

type Props = {
  restaurant: MenuOrderingRestaurant;
  sushiRoundSettings: SushiRoundSettings;
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  recommendedItemIds?: string[];
  /** Slot windows from the catalog (`menu_items.time_slot_id`). */
  menuTimeSlots: MenuTimeSlot[];
  notePresetCatalog?: import('@/lib/menu-note-presets').MenuNotePresetCatalog;
  catalogReady?: boolean;
  guestListMotionEnabled?: boolean;
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
  recommendedItemIds = [],
  menuTimeSlots,
  notePresetCatalog = { groups: [] },
  catalogReady = true,
  guestListMotionEnabled = false,
  tableId,
  displayName,
  orderCooldownSeconds,
  initialSessionContext = null,
  isDemo,
}: Props) {
  const { lang } = useLanguage();
  const t = MENU_PAGE_MESSAGES[lang];
  const roundT = SUSHI_ROUND_MESSAGES[lang];
  const flavorHintsEnabled = isRestaurantFeatureEnabled(
    restaurant.feature_flags,
    'menu_flavor_hints_enabled',
  );
  const [activeTopCategory, setActiveTopCategory] = useState<string>('Pratos');
  const [activeSubpath, setActiveSubpath] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartAddFeedbackKey, setCartAddFeedbackKey] = useState(0);
  const { submitFeedback, signalSubmitFeedback } = useCustomerMenuSubmitFeedback();
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const [cartOpen, setCartOpen] = useState(false);
  const selfBatchIdsRef = useRef<Set<string>>(new Set());
  const [selfBatchIds, setSelfBatchIds] = useState<ReadonlySet<string>>(() => new Set());
  const [orderedOpen, setOrderedOpen] = useState(false);
  const [roundReviewOpen, setRoundReviewOpen] = useState(false);
  const [detailMenuItemId, setDetailMenuItemId] = useState<string | null>(null);
  const [dietaryPrefs, setDietaryPrefs] = useState<CustomerMenuDietaryFilterPrefs>(
    EMPTY_CUSTOMER_MENU_DIETARY_FILTER_PREFS,
  );
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
    ordersSnapshotReady,
    refresh: refreshSessionContext,
    isSessionContextFresh,
  } = useCustomerSessionContext(initialSessionContext, {
    slug: restaurant.slug,
    tableId,
    isDemo,
    resumeScope: orderedOpen ? 'full' : 'gate',
  });
  const menuTimeSlotId = useSessionMenuTimeSlotId(menuTimeSlots, activeSession?.opened_at);

  const refreshOrderedFromRealtime = useCallback(() => {
    void refreshSessionContext('full');
  }, [refreshSessionContext]);

  const tableSessionRealtimeEnabled = customerTableSessionRealtimeEnabled({
    isDemo,
    staffAssisted: null,
    sessionResolved,
    tableId,
  });

  const round = useTableOrderRound({
    slug: restaurant.slug,
    restaurantId: restaurant.id,
    tableId,
    sessionId: activeSession?.id ?? null,
    enabled: !isDemo && sessionResolved && !!activeSession,
    initialSettings: sushiRoundSettings,
  });
  const setRoundPeerNotifyOpen = round.setPeerNotifyOpen;

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

  // Individual checkout: a phone with a called, unpaid ticket cannot add dishes (table stays open).
  const individualHold = useIndividualCheckoutHold({
    slug: restaurant.slug,
    restaurantId: restaurant.id,
    tableId,
    sessionId: activeSession?.id,
    enabled: !!activeSession && !isDemo,
  });

  const markIndividualHold = individualHold.markHold;

  const ensureGuestCanPlaceOrder = useCallback(async () => {
    const gate = await (async () => {
      if (!sessionResolved) {
        const data = await refreshSessionContext('gate');
        return guestOrderGateFromSessionContext(data);
      }
      const cached = guestOrderGateFromCachedState(isDemo ?? false, activeSession);
      if (cached) return cached;
      const data = await refreshSessionContext('gate');
      return guestOrderGateFromSessionContext(data);
    })();
    return withIndividualHold(gate, individualHold.hold);
  }, [activeSession, individualHold.hold, isDemo, refreshSessionContext, sessionResolved]);

  const vegFilterEnabled = sushiRoundSettings.sushi_menu_vegetarian_filter_enabled;
  const allergenFilterEnabled = sushiRoundSettings.sushi_menu_allergen_filter_enabled;

  useEffect(() => {
    setDietaryPrefs((prev) => {
      let next = prev;
      if (!vegFilterEnabled && prev.vegetarianOnly) {
        next = { ...next, vegetarianOnly: false };
      }
      if (!allergenFilterEnabled && prev.excludeAllergenCodes.length > 0) {
        next = { ...next, excludeAllergenCodes: [] };
      }
      return next;
    });
  }, [vegFilterEnabled, allergenFilterEnabled]);

  const filteredMenuItems = useMemo(
    () =>
      filterMenuItemsByDietaryPrefs(menuItems, {
        vegetarianOnly: vegFilterEnabled ? dietaryPrefs.vegetarianOnly : false,
        excludeAllergenCodes: allergenFilterEnabled ? dietaryPrefs.excludeAllergenCodes : [],
      }),
    [menuItems, dietaryPrefs, vegFilterEnabled, allergenFilterEnabled],
  );

  const catalogView = useMemo(
    () =>
      resolveCustomerMenuCatalogView({
        menuCategories,
        menuItems: filteredMenuItems,
        recommendedItemIds,
        menuTimeSlotId,
        activeTopId: activeTopCategory,
        activeSubpath,
      }),
    [
      menuCategories,
      filteredMenuItems,
      recommendedItemIds,
      menuTimeSlotId,
      activeTopCategory,
      activeSubpath,
    ],
  );
  const currentTop = catalogView.currentTopId;
  const subCategories = catalogView.subCategories;
  const currentSubpath = catalogView.currentSubpath;
  const currentItems = catalogView.currentItems;

  const menuItemCodeById = useMemo(() => menuItemCodeLookupFromRows(menuItems), [menuItems]);
  const guestCanOrder = useMemo(
    () => sessionResolved && guestOrderingEnabled(activeSession) && !individualHold.hold,
    [activeSession, individualHold.hold, sessionResolved],
  );

  const buffetServiceMode = normalizeBuffetServiceMode(restaurant.buffet_service_mode);
  const [initiatorConfirmOpen, setInitiatorConfirmOpen] = useState(false);
  const countdownActive = round.snapshot.round?.status === 'pending_confirm';

  const resolveLimitItem = useCallback(
    (id: string) => {
      const found = menuItems.find((m) => m.id === id);
      if (!found) return null;
      return {
        per_person_qty_limit: found.per_person_qty_limit,
        over_limit_unit_price: found.over_limit_unit_price,
        price: found.price,
      };
    },
    [menuItems],
  );

  const commitCartQty = useCallback((item: MenuItem, nextQty: number) => {
    const prev = cartRef.current;
    const next = upsertCartItemQty(prev, item, nextQty);
    cartRef.current = next;
    setCart(next);
    bumpCartAddFeedbackKeyIfIncreased(setCartAddFeedbackKey, prev, next);
  }, []);

  /** Sole local free-draft gate (桌上限 + 整餐单菜). Returns false when blocked. */
  const assertFreeCartDraftOk = useCallback(
    (proposedCart: CartItem[]): boolean => {
      if (!round.guestClientId) {
        showToast(t.submitFailed, 'error');
        return false;
      }
      const freeCart = proposedCart.filter((c) => isSushiRoundFreeMenuPrice(c.price));
      if (freeCart.length === 0) return true;
      const noteContext = { catalog: notePresetCatalog, lang };
      const draftGate = previewGuestRoundCartDraftGates({
        linesQtyTotal: round.snapshot.lines_qty_total,
        roundCapTotal: round.snapshot.round_cap_total,
        serviceMode: buffetServiceMode,
        guestCount: sessionGuestCountForLimits(recentOrders),
        sessionOrders: recentOrders,
        roundLines: round.snapshot.lines,
        guestClientId: round.guestClientId,
        cart: freeCart.map((c) => {
          const limitItem = resolveLimitItem(c.menuItemId) ?? {
            price: c.price,
            per_person_qty_limit: null,
            over_limit_unit_price: null,
          };
          return {
            menuItemId: c.menuItemId,
            qty: coerceCartQty(c.qty),
            note: cartItemWireNote(c, noteContext),
            item: limitItem,
          };
        }),
      });
      if (!draftGate.ok) {
        showToast(messageForGuestRoundQtyPreview(draftGate, roundT, t), 'info');
        return false;
      }
      return true;
    },
    [
      buffetServiceMode,
      lang,
      notePresetCatalog,
      recentOrders,
      resolveLimitItem,
      round.guestClientId,
      round.snapshot.lines,
      round.snapshot.lines_qty_total,
      round.snapshot.round_cap_total,
      roundT,
      t,
    ],
  );

  const requestQtyChange = useCallback(
    async (menuItemId: string, rawNextQty: number) => {
      if (!catalogReady) return;
      const item = menuItems.find((m) => m.id === menuItemId);
      if (!item) return;

      const gate = await ensureGuestCanPlaceOrder();
      if (!gate.canPlace) {
        showToast(guestOrderingActionHint(lang, gate.sessionStatus, gate.individualHold), 'info');
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
        if (nextQty > 0) {
          const proposed = upsertCartItemQty(cartRef.current, item, nextQty);
          if (!assertFreeCartDraftOk(proposed)) return;
        }
      }

      if (nextQty > APPEND_CART_QTY_MAX) nextQty = APPEND_CART_QTY_MAX;
      commitCartQty(item, nextQty);
      if (nextQty <= 0 && cartRef.current.length === 0) setCartOpen(false);
    },
    [
      assertFreeCartDraftOk,
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
    if (isSushiRoundFreeMenuPrice(item.price)) {
      const cartEntry = cart.find((c) => c.menuItemId === item.id);
      const current = sushiFreeItemDisplayQty({
        cartHasItem: !!cartEntry,
        cartQty: cartEntry?.qty,
      });
      void requestQtyChange(item.id, current + delta);
      return;
    }
    const current = coerceCartQty(cart.find((c) => c.menuItemId === item.id)?.qty);
    void requestQtyChange(item.id, current + delta);
  };

  const detailItem = useMemo(
    () => (detailMenuItemId ? menuItems.find((m) => m.id === detailMenuItemId) ?? null : null),
    [detailMenuItemId, menuItems],
  );

  useEffect(() => {
    if (!detailMenuItemId) return;
    if (!filteredMenuItems.some((m) => m.id === detailMenuItemId)) {
      setDetailMenuItemId(null);
    }
  }, [detailMenuItemId, filteredMenuItems]);

  const ensureDetailCartLine = useCallback(
    (item: MenuItem) => {
      const prev = cartRef.current;
      if (prev.some((c) => c.menuItemId === item.id)) return;
      if (isSushiRoundFreeMenuPrice(item.price)) {
        const proposed = upsertCartItemQty(prev, item, 1);
        if (!assertFreeCartDraftOk(proposed)) return;
      }
      const next = upsertCartItemQty(prev, item, 1);
      cartRef.current = next;
      setCart(next);
      bumpCartAddFeedbackKeyIfIncreased(setCartAddFeedbackKey, prev, next);
    },
    [assertFreeCartDraftOk],
  );

  const updateDetailNote = useCallback(
    (note: string) => {
      if (!detailItem) return;
      if (!cartRef.current.some((c) => c.menuItemId === detailItem.id)) {
        ensureDetailCartLine(detailItem);
      }
      if (!cartRef.current.some((c) => c.menuItemId === detailItem.id)) return;
      const id = detailItem.id;
      setCart((prev) => {
        if (!prev.some((c) => c.menuItemId === id)) return prev;
        const next = prev.map((c) =>
          c.menuItemId === id ? { ...c, note: clampAppendCartNote(note) } : c,
        );
        cartRef.current = next;
        return next;
      });
    },
    [detailItem, ensureDetailCartLine],
  );

  const toggleDetailNotePreset = useCallback(
    (presetId: string) => {
      if (!detailItem) return;
      if (!cartRef.current.some((c) => c.menuItemId === detailItem.id)) {
        ensureDetailCartLine(detailItem);
      }
      if (!cartRef.current.some((c) => c.menuItemId === detailItem.id)) return;
      const id = detailItem.id;
      setCart((prev) => {
        if (!prev.some((c) => c.menuItemId === id)) return prev;
        const next = prev.map((c) =>
          c.menuItemId === id
            ? {
                ...c,
                selectedNotePresetIds: toggleCartNotePresetSelection(
                  c.selectedNotePresetIds || [],
                  notePresetCatalog,
                  presetId,
                ),
              }
            : c,
        );
        cartRef.current = next;
        return next;
      });
    },
    [detailItem, ensureDetailCartLine, notePresetCatalog],
  );
  const detailCartEntry = detailItem
    ? cart.find((c) => c.menuItemId === detailItem.id)
    : undefined;
  const detailCartQty = detailItem
    ? isSushiRoundFreeMenuPrice(detailItem.price)
      ? sushiFreeItemDisplayQty({
          cartHasItem: !!detailCartEntry,
          cartQty: detailCartEntry?.qty,
        })
      : coerceCartQty(detailCartEntry?.qty)
    : 0;
  const detailLimitHint = useMemo(() => {
    if (!detailItem) return null;
    const hintParts = sushiLimitHintParts(buffetServiceMode, detailItem);
    if (!hintParts) return null;
    return t.sushiLimitHint
      .replace('{perPerson}', String(hintParts.perPerson))
      .replace('{price}', hintParts.overLimitPrice.toFixed(2));
  }, [buffetServiceMode, detailItem, t.sushiLimitHint]);

  const updateNote = (menuItemId: string, note: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.menuItemId === menuItemId ? { ...c, note: clampAppendCartNote(note) } : c,
      ),
    );
  };

  const toggleNotePreset = (menuItemId: string, presetId: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.menuItemId === menuItemId
          ? {
              ...c,
              selectedNotePresetIds: toggleCartNotePresetSelection(
                c.selectedNotePresetIds || [],
                notePresetCatalog,
                presetId,
              ),
            }
          : c,
      ),
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
        roundTableQty: round.tableReviewQty,
      }),
    [
      activeSession,
      cart,
      recentOrders,
      restaurant.slug,
      round.ownReviewQty,
      round.tableReviewQty,
      sessionResolved,
      tableId,
    ],
  );
  const sendGuidance = useSushiSendGuidance({
    snapshot: round.snapshot,
    tableReviewQty: round.tableReviewQty,
  });
  const cartSubmitLabel = resolveSushiCartSubmitLabel({
    hasFree: cart.some((c) => isSushiRoundFreeMenuPrice(c.price)),
    hasPaid: cart.some((c) => !isSushiRoundFreeMenuPrice(c.price)),
    roundT,
    placeOrder: t.placeOrder,
  });

  const roundStatus = round.snapshot.round?.status;
  const inTableCooldown =
    roundStatus === 'cooldown' &&
    isCooldownActive(roundStatus, round.snapshot.round?.cooldown_until ?? null);
  const canSendRound =
    round.tableReviewQty > 0 &&
    (roundStatus === 'collecting' || roundStatus == null) &&
    !inTableCooldown &&
    !countdownActive;
  const pageBottomPaddingClass = customerMenuPageBottomPaddingClass(footer.visible);
  const guestNotice = useMemo(
    () => resolveGuestOrderingNoticeForDisplay(restaurant.guest_ordering_notice, lang),
    [lang, restaurant.guest_ordering_notice],
  );

  const [reviewBusyLineId, setReviewBusyLineId] = useState<string | null>(null);

  const roundReviewGroups = useMemo(
    () =>
      buildTableRoundReviewGroups({
        lines: round.snapshot.lines,
        guestClientId: round.guestClientId,
        menuItems,
        lang,
        ownBlockLabel: roundT.reviewOwnBlock,
        ownLinesEditable: round.ownLinesEditable,
      }),
    [
      lang,
      menuItems,
      round.guestClientId,
      round.ownLinesEditable,
      round.snapshot.lines,
      roundT.reviewOwnBlock,
    ],
  );

  const handleOwnRoundLineQtyChange = useCallback(
    async (lineId: string, rawNextQty: number) => {
      if (reviewBusyLineId) return;
      let nextQty = Math.floor(Number(rawNextQty));
      if (!Number.isFinite(nextQty)) return;
      if (nextQty > APPEND_CART_QTY_MAX) nextQty = APPEND_CART_QTY_MAX;
      const line = round.snapshot.lines.find((l) => l.id === lineId);
      if (line && nextQty > 0 && round.guestClientId) {
        const limitItem = resolveLimitItem(line.menu_item_id);
        if (limitItem) {
          const setGate = previewGuestRoundLineSetGates({
            linesQtyTotal: round.snapshot.lines_qty_total,
            roundCapTotal: round.snapshot.round_cap_total,
            currentLineQty: line.qty,
            serviceMode: buffetServiceMode,
            guestCount: sessionGuestCountForLimits(recentOrders),
            sessionOrders: recentOrders,
            roundLines: round.snapshot.lines,
            guestClientId: round.guestClientId,
            menuItemId: line.menu_item_id,
            note: line.note ?? '',
            qty: nextQty,
            item: limitItem,
          });
          if (!setGate.ok) {
            showToast(messageForGuestRoundQtyPreview(setGate, roundT, t), 'info');
            return;
          }
        }
      }
      setReviewBusyLineId(lineId);
      try {
        const result = await round.setOwnRoundLineQty(lineId, nextQty);
        if (!result.ok) {
          if (
            result.error === 'per_person_limit_exceeded' ||
            result.error === 'limited_item_requires_headcount' ||
            result.error === 'menu_item_off_time_slot' ||
            result.error === 'over_limit_price_missing'
          ) {
            showToast(messageForSushiLimitError(result.error, t), 'info');
            return;
          }
          showToast(
            messageForSushiRoundError(result.error, roundT, {
              used: round.snapshot.lines_qty_total,
              cap: round.snapshot.round_cap_total,
            }),
            'info',
          );
        }
      } finally {
        setReviewBusyLineId(null);
      }
    },
    [
      buffetServiceMode,
      recentOrders,
      resolveLimitItem,
      reviewBusyLineId,
      round,
      roundT,
      t,
    ],
  );

  /** Peer notify reads the same live countdown as the guidance strip. */
  const countdownSeconds = sendGuidance?.kind === 'countdown' ? sendGuidance.seconds : 0;
  const roundPaidSentLines = useMemo(() => {
    const status = round.snapshot.round?.status;
    const activeForReview =
      status === 'collecting' || status === 'pending_confirm' || status === 'finalize_failed';
    return buildRoundPaidSentLines({
      orders: recentOrders,
      roundStartedAt: activeForReview ? round.snapshot.round?.created_at : null,
      lang,
      menuItems,
    });
  }, [
    lang,
    menuItems,
    recentOrders,
    round.snapshot.round?.created_at,
    round.snapshot.round?.status,
  ]);


  const formatCountLabel = useCallback(
    (template: string, count: number) => template.replace('{count}', String(count)),
    [],
  );

  const clearSubmitCart = useCallback(() => {
    setCart([]);
    setCartOpen(false);
  }, []);

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
        showToast(
          guestOrderingActionHint(lang, failure.sessionStatus, failure.individualHold),
          'info',
        );
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
        if (failure.code === 'individual_called') {
          markIndividualHold();
          showToast(t.individualCalledHint, 'info');
          return;
        }
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
          failure.code === 'limited_item_requires_headcount' ||
          failure.code === 'menu_item_off_time_slot'
        ) {
          showToast(messageForSushiLimitError(failure.code, t), 'info');
        } else if (failure.code === 'rate_limited') showToast(t.submitRateLimited, 'error');
        else if (failure.code === 'sushi_round_required') showToast(roundT.basketLocked, 'info');
        else showToast(t.submitFailed, 'error');
        return;
      }
      showToast(t.submitFailed, 'error');
    },
    [lang, markIndividualHold, refreshSessionContext, roundT.basketLocked, t],
  );

  const submitCart = async () => {
    if (!catalogReady || cart.length === 0 || isSubmitCooldownActive) return;
    if (submittingRef.current) return;

    if (isDemo) {
      restartSubmitCooldown();
      setCart([]);
      setCartOpen(false);
      signalSubmitFeedback(t.orderSuccess);
      return;
    }

    const freeCart = cart.filter((c) => isSushiRoundFreeMenuPrice(c.price));
    const paidCart = cart.filter((c) => !isSushiRoundFreeMenuPrice(c.price));

    const noteContext = { catalog: notePresetCatalog, lang };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (freeCart.length > 0) {
        if (!round.guestClientId) {
          showToast(t.submitFailed, 'error');
          return;
        }
        let freeSessionOrders = recentOrders;
        const freeQtyRows = freeCart.map((c) => ({
          menuItemId: c.menuItemId,
          qty: coerceCartQty(c.qty),
        }));
        const freeNeedsOrders = guestCartHasLimitedSushiItems({
          serviceMode: buffetServiceMode,
          cart: freeQtyRows,
          resolveItem: resolveLimitItem,
        });
        if (freeNeedsOrders && !isSessionContextFresh()) {
          const fresh = await refreshSessionContext('full');
          freeSessionOrders = fresh?.recent_orders ?? recentOrders;
        }
        const freeDraftGate = previewGuestRoundCartDraftGates({
          linesQtyTotal: round.snapshot.lines_qty_total,
          roundCapTotal: round.snapshot.round_cap_total,
          serviceMode: buffetServiceMode,
          guestCount: sessionGuestCountForLimits(freeSessionOrders),
          sessionOrders: freeSessionOrders,
          roundLines: round.snapshot.lines,
          guestClientId: round.guestClientId,
          cart: freeCart.map((c) => {
            const item = resolveLimitItem(c.menuItemId) ?? {
              price: c.price,
              per_person_qty_limit: null,
              over_limit_unit_price: null,
            };
            return {
              menuItemId: c.menuItemId,
              qty: coerceCartQty(c.qty),
              note: cartItemWireNote(c, noteContext),
              item,
            };
          }),
        });
        if (!freeDraftGate.ok) {
          showToast(messageForGuestRoundQtyPreview(freeDraftGate, roundT, t), 'info');
          return;
        }
        const result = await round.commitCartToRound(
          freeCart.map((c) => ({
            menuItemId: c.menuItemId,
            qty: coerceCartQty(c.qty),
            note: cartItemWireNote(c, noteContext),
          })),
        );
        if (!result.ok) {
          if (
            result.error === 'per_person_limit_exceeded' ||
            result.error === 'limited_item_requires_headcount' ||
            result.error === 'menu_item_off_time_slot' ||
            result.error === 'over_limit_price_missing'
          ) {
            showToast(messageForSushiLimitError(result.error, t), 'info');
            return;
          }
          showToast(
            messageForSushiRoundError(result.error, roundT, {
              used: round.snapshot.lines_qty_total,
              cap: round.snapshot.round_cap_total,
            }),
            'info',
          );
          return;
        }
        setCart(paidCart);
        if (paidCart.length > 0) {
          // Free lines are in the round even if the paid append below fails.
          signalSubmitFeedback(roundT.placedInRound);
        }
      }

      if (paidCart.length === 0) {
        restartSubmitCooldown();
        clearSubmitCart();
        setRoundReviewOpen(true);
        signalSubmitFeedback(roundT.placedInRound);
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
        noteContext,
        previous: pendingAppendIntentRef.current,
      });
      pendingAppendIntentRef.current = {
        clientRequestId: intent.clientRequestId,
        fingerprint: intent.fingerprint,
      };

      const result = await executeMenuOrderSubmit({
        flow: 'guest',
        cart: paidCart,
        noteContext,
        slug: restaurant.slug,
        tableId,
        waiterFlow: false,
        clientRequestId: intent.clientRequestId,
        guestClientId: individualHold.guestClientId,
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
      if (result.batchId) {
        selfBatchIdsRef.current.add(result.batchId);
        setSelfBatchIds(new Set(selfBatchIdsRef.current));
      }
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
        clearCart: clearSubmitCart,
        signalSubmitted: () =>
          signalSubmitFeedback(freeCart.length > 0 ? roundT.placedMixed : t.orderSuccess),
      });
    } catch {
      showToast(t.submitFailed, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSendRound = () => {
    if (roundBusy || !canSendRound) return;
    setInitiatorConfirmOpen(true);
  };

  /** Sole kitchen-send success → back to menu (核单/确认/同桌提示/购物车/已点/详情). */
  const dismissToMenuAfterKitchenSend = useCallback(() => {
    setRoundReviewOpen(false);
    setInitiatorConfirmOpen(false);
    setRoundPeerNotifyOpen(false);
    setCartOpen(false);
    setOrderedOpen(false);
    setDetailMenuItemId(null);
    // Drop local free drafts; next round counts only from a settled empty snapshot.
    setCart((prev) => {
      const next = prev.filter((c) => !isSushiRoundFreeMenuPrice(c.price));
      cartRef.current = next;
      return next;
    });
  }, [setRoundPeerNotifyOpen]);

  const handleConfirmSendRound = async () => {
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
      // Initiate only: leave review so guest can keep browsing during countdown.
      // Authoritative full dismiss is dismissToMenuAfterKitchenSend on cooldown edge.
      setInitiatorConfirmOpen(false);
      setRoundReviewOpen(false);
    } finally {
      setRoundBusy(false);
    }
  };

  const kitchenSendDismissedRoundIdRef = useRef<string | null>(null);
  const prevRoundStatusRef = useRef<TableOrderRoundStatus | null | undefined>(undefined);
  const roundStatusBootstrappedRef = useRef(false);

  useEffect(() => {
    kitchenSendDismissedRoundIdRef.current = null;
    prevRoundStatusRef.current = undefined;
    roundStatusBootstrappedRef.current = false;
  }, [activeSession?.id, tableId]);

  useEffect(() => {
    if (!round.snapshotReady) return;
    const status = round.snapshot.round?.status ?? null;
    const roundId = round.snapshot.round?.id ?? null;

    if (!roundStatusBootstrappedRef.current) {
      roundStatusBootstrappedRef.current = true;
      prevRoundStatusRef.current = status;
      return;
    }

    const prev = prevRoundStatusRef.current;
    prevRoundStatusRef.current = status;

    if (!isKitchenSendSuccessStatusTransition(prev, status)) return;

    const dedupeKey = kitchenSendSuccessDedupeKey(roundId);
    if (!dedupeKey || kitchenSendDismissedRoundIdRef.current === dedupeKey) return;
    kitchenSendDismissedRoundIdRef.current = dedupeKey;

    dismissToMenuAfterKitchenSend();
    signalSubmitFeedback(roundT.sentToast);
    if (activeSession?.id) {
      void refreshSessionContext('full').catch(() => {});
    }
  }, [
    activeSession?.id,
    dismissToMenuAfterKitchenSend,
    refreshSessionContext,
    round.snapshot.round?.id,
    round.snapshot.round?.status,
    round.snapshotReady,
    roundT.sentToast,
    signalSubmitFeedback,
  ]);

  const rootClassName = `${customerMenuDualPaneRootClass} h-dvh ${customerMenuShellRootClass} ${pageBottomPaddingClass}`;

  return (
    <div className={rootClassName}>
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        showRestaurantName={false}
        sticky
        backLink={null}
        notice={
          guestNotice && !isDemo ? (
            <CustomerGuestOrderingNotice restaurantId={restaurant.id} notice={guestNotice} lang={lang} />
          ) : null
        }
      />

      {!isDemo ? (
        <SushiRoundStickyBar
          snapshot={round.snapshot}
          unsentQty={round.tableReviewQty}
          labels={roundT}
          lang={lang}
          dietaryFilter={
            vegFilterEnabled || allergenFilterEnabled
              ? {
                  vegetarianFilterEnabled: vegFilterEnabled,
                  allergenFilterEnabled: allergenFilterEnabled,
                  prefs: dietaryPrefs,
                  onVegetarianOnlyChange: (next) =>
                    setDietaryPrefs((p) => ({ ...p, vegetarianOnly: next })),
                  onExcludeAllergenCodesChange: (codes) =>
                    setDietaryPrefs((p) => ({
                      ...p,
                      excludeAllergenCodes: codes as AllergenCode[],
                    })),
                }
              : null
          }
        />
      ) : null}

      <IndividualCheckoutNotice
        sessionId={activeSession?.id}
        enabled={!!activeSession && !isDemo}
        suppressModal={individualHold.hold}
        onSignals={() => void individualHold.refresh()}
      />

      {!isDemo && sessionResolved && !guestCanOrder ? (
        <CustomerMenuOrderGateBanner
          message={guestOrderingBannerHint(lang, activeSession?.status ?? null, individualHold.hold)}
        />
      ) : null}

      <div className={customerMenuContentHostClass}>
      <CustomerMenuStorefrontScroll restaurant={restaurant} lang={lang} enabled={!isDemo}>
      <CustomerMenuCategoryNav
        scrollMode={customerMenuCategoryScrollModeForStorefront(!isDemo, restaurant)}
        topCategories={customerMenuNavTopCategories(
          catalogView,
          (cat) => getMenuCategoryLabel(cat, lang),
          cart,
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
        catalogLeading={
          catalogReady ? (
            <CustomerRecommendedRail
              items={catalogView.recommendedItems}
              lang={lang}
              title={t.recommended}
              treatZeroAsFree
              onOpenDetail={(menuItemId) => {
                setCartOpen(false);
                setOrderedOpen(false);
                setRoundReviewOpen(false);
                setDetailMenuItemId(menuItemId);
              }}
            />
          ) : null
        }
      >
        {!catalogReady ? (
          <CustomerMenuCatalogSkeleton />
        ) : currentItems.length === 0 ? (
          <p className="text-center text-brand-text-muted py-12 text-sm">{t.noItems}</p>
        ) : (
          <div className={CUSTOMER_MENU_ITEM_LIST_CLASS}>
            {currentItems.map((item) => {
              const cartEntry = cart.find((c) => c.menuItemId === item.id);
              const cartQty = isSushiRoundFreeMenuPrice(item.price)
                ? sushiFreeItemDisplayQty({
                    cartHasItem: !!cartEntry,
                    cartQty: cartEntry?.qty,
                  })
                : coerceCartQty(cartEntry?.qty);
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
                  treatZeroAsFree
                  flavorHintsEnabled={flavorHintsEnabled}
                  listMotionEnabled={guestListMotionEnabled}
                  onOpenDetail={() => {
                    setCartOpen(false);
                    setOrderedOpen(false);
                    setRoundReviewOpen(false);
                    setDetailMenuItemId(item.id);
                  }}
                  onIncrement={() => bumpItem(item, 1)}
                  onDecrement={() => bumpItem(item, -1)}
                />
              );
            })}
          </div>
        )}
      </CustomerMenuCategoryNav>
      </CustomerMenuStorefrontScroll>

      <CustomerMenuPeerFloats
        lines={round.snapshot.lines}
        guestClientId={round.guestClientId}
        menuItems={menuItems}
        lang={lang}
        enabled={!isDemo && Boolean(round.guestClientId)}
        tableId={tableId}
        sessionId={activeSession?.id ?? null}
        roundSnapshotReady={round.snapshotReady}
        paidOrdersReady={ordersSnapshotReady}
        recentOrders={recentOrders}
        selfBatchIds={selfBatchIds}
      />
      </div>

      <CustomerMenuFooter
        {...footer}
        cartAddFeedbackKey={cartAddFeedbackKey}
        submitFeedback={submitFeedback}
        guidance={
          sendGuidance ? <SushiSendGuidanceStrip guidance={sendGuidance} lang={lang} /> : null
        }
        labels={{
          viewCart: t.viewCart,
          viewBill: t.viewBillLink,
          viewOrdered: t.viewOrdered,
          viewRoundReview:
            sendGuidance?.kind === 'unsent'
              ? formatCountLabel(roundT.goToSend, sendGuidance.qty)
              : roundT.viewRoundReview,
          roundReviewCount: (count) => formatCountLabel(roundT.roundReviewCount, count),
          placeOrder: cartSubmitLabel,
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

      <CustomerMenuItemDetailSheet
        open={!!detailItem}
        item={detailItem}
        lang={lang}
        cartQty={detailCartQty}
        treatZeroAsFree
        limitHint={detailLimitHint}
        flavorHintsEnabled={flavorHintsEnabled}
        notePresetCatalog={notePresetCatalog}
        note={detailCartEntry?.note || ''}
        selectedNotePresetIds={detailCartEntry?.selectedNotePresetIds || []}
        onUpdateNote={updateDetailNote}
        onToggleNotePreset={toggleDetailNotePreset}
        onClose={() => setDetailMenuItemId(null)}
        onIncrement={() => {
          if (detailItem) bumpItem(detailItem, 1);
        }}
        onDecrement={() => {
          if (detailItem) bumpItem(detailItem, -1);
        }}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        menuItems={menuItems}
        menuItemCodeById={menuItemCodeById}
        notePresetCatalog={notePresetCatalog}
        lang={lang}
        onClose={() => setCartOpen(false)}
        onUpdateQty={(id, qty) => {
          void requestQtyChange(id, qty);
        }}
        onClearCart={clearSubmitCart}
        onUpdateNote={updateNote}
        onToggleNotePreset={toggleNotePreset}
        onSubmit={submitCart}
        submitting={submitting}
        submitCooldownRemaining={submitCooldownRemaining}
        submitActionLabel={cartSubmitLabel}
      />

      <SushiRoundReviewDrawer
        open={roundReviewOpen}
        groups={roundReviewGroups}
        labels={{
          title: roundT.reviewTitle,
          empty: roundT.reviewEmpty,
          notYet: roundT.reviewNotYet,
          continueOrdering: t.continueOrdering,
          sendRound: roundT.sendRound,
          paidSentTitle: roundT.reviewPaidSentTitle,
        }}
        paidSentLines={roundPaidSentLines}
        guidance={sendGuidance}
        lang={lang}
        canSend={canSendRound}
        sendBusy={roundBusy}
        countdownActive={countdownActive}
        busyLineId={reviewBusyLineId}
        onClose={() => setRoundReviewOpen(false)}
        onSend={() => handleSendRound()}
        onOwnLineQtyChange={(lineId, nextQty) => {
          void handleOwnRoundLineQtyChange(lineId, nextQty);
        }}
      />

      <OrderedDrawer
        open={orderedOpen}
        orders={recentOrders}
        menuItems={menuItems}
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
        open={initiatorConfirmOpen}
        onClose={() => setInitiatorConfirmOpen(false)}
        title={roundT.confirmTitle}
        message={roundT.confirmMessage.replace(
          '{n}',
          String(round.settings.sushi_round_cooldown_seconds),
        )}
        confirmLabel={roundT.confirmAction}
        cancelLabel={roundT.confirmCancel}
        onConfirm={() => void handleConfirmSendRound()}
        confirming={roundBusy}
      />

      <ConfirmModal
        open={round.peerNotifyOpen}
        onClose={() => setRoundPeerNotifyOpen(false)}
        title={roundT.peerNotifyTitle}
        message={roundT.peerNotifyMessage.replace('{n}', String(countdownSeconds))}
        confirmLabel={roundT.peerNotifyAction}
        cancelLabel={undefined}
        onConfirm={() => setRoundPeerNotifyOpen(false)}
        confirming={false}
      />

      <CustomerOrderingIntroModal
        open={introVisible}
        lang={lang}
        copy={introCopy}
        onDismiss={dismissIntro}
        showSplitPreview={false}
      />

      <CustomerTableSessionRealtimeLazy
        tableId={tableId}
        enabled={tableSessionRealtimeEnabled}
        onRefresh={refreshOrderedFromRealtime}
      />
    </div>
  );
}
