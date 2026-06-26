'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  AppendCartLineInput,
  MenuItem,
  Language,
  CartItem,
  Order,
  TableSession,
  MenuCategory,
} from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { CartDrawer } from './CartDrawer';
import { CATEGORY_LABELS, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { formatOrderItemListLabel, orderListGuestLabelsFromLang } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { getClientLanguage, setClientLanguage } from '@/lib/i18n';
import { coerceCartPrice, coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import { showToast } from '@/components/ui/Toast';
import { autoEnqueueStationTicketsAfterSubmit } from '@/lib/auto-enqueue-station-tickets';
import { normalizeOrderRadiusMeters } from '@/lib/order-radius';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import { requestCustomerSessionContext } from '@/lib/request-customer-context';
import { useCustomerContextPoll } from '@/lib/use-customer-context-poll';

const LANG_FLAGS: Record<Language, string> = { pt: '🇵🇹', en: '🇬🇧', zh: '🇨🇳' };
const LANG_LABELS: Record<Language, string> = { pt: 'PT', en: 'EN', zh: '中' };

interface Props {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    geo_latitude?: number | null;
    geo_longitude?: number | null;
    order_radius_meters?: number | null;
  };
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  tableId: string;
  displayName: string;
  isDemo?: boolean;
  returnToWaiterHref?: string | null;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

async function getBrowserLocation() {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('not-supported');
  }

  const attempt = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  try {
    return await attempt({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  } catch {
    return attempt({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 120000,
    });
  }
}

const WAITER_RETURN_REDIRECT_MS = 1200;

export function MenuPage({ restaurant, menuItems, menuCategories, tableId, displayName, isDemo, returnToWaiterHref }: Props) {
  const router = useRouter();
  const isWaiterFlow = !!returnToWaiterHref;
  const [lang, setLang] = useState<Language>(() => getClientLanguage() as Language);
  const [activeTopCategory, setActiveTopCategory] = useState<string>('Pratos');
  const [activeSubpath, setActiveSubpath] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [demoToast, setDemoToast] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);
  const [latestBatchId, setLatestBatchId] = useState<string | null>(null);

  // 从 localStorage 恢复语言设置
  useEffect(() => {
    const savedLegacy = localStorage.getItem('mesa-lang') as Language | null;
    if (savedLegacy && ['pt', 'en', 'zh'].includes(savedLegacy)) {
      setLang(savedLegacy);
      setClientLanguage(savedLegacy);
      return;
    }
  }, []);

  const setLangAndSave = (l: Language) => {
    setLang(l);
    setClientLanguage(l);
    localStorage.setItem('mesa-lang', l);
  };

  const loadSessionAndOrders = useCallback(async () => {
    const data = await requestCustomerSessionContext(restaurant.slug, tableId);
    if (!data) return;
    setActiveSession((data.active_session as TableSession | null) || null);
    if (!data.active_session) {
      setRecentOrders([]);
      return;
    }
    setRecentOrders((data.recent_orders || []) as Order[]);
  }, [restaurant.slug, tableId]);

  useCustomerContextPoll({
    enabled: !isDemo,
    hasActiveSession: !!activeSession,
    onPoll: loadSessionAndOrders,
  });

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
    () => guestOrderingEnabled(activeSession, recentOrders),
    [activeSession, recentOrders],
  );
  const canPlaceMenuOrders = isDemo || guestCanOrder;
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
  const bumpCartItem = (item: MenuItem, delta: number) => {
    if (!canPlaceMenuOrders) {
      showToast(guestOrderingHints.action, 'info');
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
  const pageBottomPaddingClass =
    totalQty > 0
      ? (isWaiterFlow ? 'pb-52' : 'pb-28')
      : (isWaiterFlow ? 'pb-24' : 'pb-16');
  // 只要本桌本餐次有下单记录，即可随时进入结账页。
  const canGoBill = !!activeSession && totalItemCount > 0;

  const finishSuccessfulSubmit = useCallback(
    (batchId?: string) => {
      if (batchId) {
        setLatestBatchId(batchId);
        setTimeout(() => setLatestBatchId(null), 15000);
      }
      setCart([]);
      setCartOpen(false);
      setSubmitted(true);
      if (isWaiterFlow && returnToWaiterHref) {
        setTimeout(() => router.push(returnToWaiterHref), WAITER_RETURN_REDIRECT_MS);
      } else {
        setTimeout(() => setSubmitted(false), 3000);
      }
    },
    [isWaiterFlow, returnToWaiterHref, router],
  );

  // 提交订单
  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (!canPlaceMenuOrders) {
      showToast(guestOrderingHints.action, 'info');
      return;
    }

    if (isDemo) {
      if (isWaiterFlow) {
        finishSuccessfulSubmit();
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
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (restaurant.geo_latitude != null && restaurant.geo_longitude != null && !isWaiterFlow) {
        let position: GeolocationPosition;
        try {
          position = await getBrowserLocation();
        } catch (error) {
          if (isLocalDevHost) {
            showToast(t.locationBypassedLocal, 'info');
            position = {
              coords: {
                latitude: restaurant.geo_latitude,
                longitude: restaurant.geo_longitude,
                accuracy: 0,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
                toJSON: () => ({}),
              },
              timestamp: Date.now(),
              toJSON: () => ({}),
            };
          } else {
            const geoError = error as GeolocationPositionError | Error;
            if ('code' in geoError && geoError.code === 1) {
              showToast(t.locationPermissionDenied, 'error');
            } else if (geoError.message === 'not-supported') {
              showToast(t.locationNotSupported, 'error');
            } else {
              showToast(t.locationCheckFailed, 'error');
            }
            return;
          }
        }

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;

        const maxMeters = normalizeOrderRadiusMeters(restaurant.order_radius_meters);
        const dist = calculateDistanceMeters(
          latitude,
          longitude,
          restaurant.geo_latitude,
          restaurant.geo_longitude,
        );
        if (dist > maxMeters) {
          if (isLocalDevHost) {
            showToast(t.locationBypassedLocal, 'info');
          } else {
            showToast(t.locationTooFar.replace('{meters}', String(maxMeters)), 'error');
            return;
          }
        }
      }

      const items: AppendCartLineInput[] = cart.map((c) => ({
        menu_item_id: c.menuItemId,
        qty: coerceCartQty(c.qty),
        ...(c.note?.trim() ? { note: c.note.trim() } : {}),
      }));

      const appendRes = await fetch(`/api/restaurants/${restaurant.slug}/orders/append`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          items,
          latitude,
          longitude,
          waiter_flow: isWaiterFlow,
        }),
      });

      const appendData = (await appendRes.json().catch(() => ({}))) as {
        error?: string;
        order_id?: string;
        batch_id?: string;
        enqueue_token?: string;
        session_id?: string;
      };

      if (!appendRes.ok) {
        const code = appendData.error || '';
        if (code === 'location_too_far') {
          const maxMeters = normalizeOrderRadiusMeters(restaurant.order_radius_meters);
          showToast(t.locationTooFar.replace('{meters}', String(maxMeters)), 'error');
        }
        else if (code === 'location_required') showToast(t.locationPermissionDenied, 'error');
        else if (code === 'session_billing') showToast(t.billDisabledHint, 'info');
        else if (code === 'buffet_required') showToast(t.buffetRequired, 'info');
        else if (code === 'rate_limited') showToast(t.printEnqueueRateLimited, 'error');
        else showToast(t.submitFailed, 'error');
        return;
      }

      const savedOrderId = appendData.order_id;
      const sessionId = appendData.session_id;
      if (!savedOrderId || !appendData.enqueue_token || !appendData.batch_id) {
        showToast(t.submitFailed, 'error');
        return;
      }

      const enqueuePromise = autoEnqueueStationTicketsAfterSubmit({
        slug: restaurant.slug,
        orderId: savedOrderId,
        batchId: appendData.batch_id,
        enqueueToken: appendData.enqueue_token,
        waiterFlow: isWaiterFlow,
        lang,
      });

      if (isWaiterFlow) {
        void enqueuePromise;
      } else {
        await enqueuePromise;
        if (sessionId) {
          await loadSessionAndOrders();
        }
      }

      finishSuccessfulSubmit(appendData.batch_id);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // Keep dev diagnostics without exposing raw errors to guests.
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

      {/* 成功提示 */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-brand-card border border-emerald-500/35 rounded-2xl p-8 text-center mx-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-heading text-2xl text-brand-text">{t.orderSuccess}</h2>
          </div>
        </div>
      )}

      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur border-b border-brand-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-heading text-xl text-brand-gold">{restaurant.name}</h1>
            <p className="text-brand-text-muted text-[13px]">{t.table} {displayName}</p>
          </div>
          {/* 语言切换 */}
          <div className="flex items-center gap-1 bg-brand-card border border-brand-border rounded-full p-1">
            {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
              <button
                key={l}
                onClick={() => setLangAndSave(l)}
                className={`px-2.5 py-1 rounded-full text-[13px] transition-all ${
                  lang === l
                    ? 'bg-brand-gold text-brand-on-gold font-semibold'
                    : 'text-brand-text-muted hover:text-brand-text'
                }`}
              >
                {LANG_FLAGS[l]} {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {/* 分类 Tab */}
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
              All
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
      </header>

      {!isDemo && !guestCanOrder && (
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
          {recentOrders.length === 0 ? (
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
          <div className="mt-4 pt-3 border-t border-brand-border">
            <Link
              href={`/${restaurant.slug}/bill?table_id=${encodeURIComponent(tableId)}`}
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-30 space-y-2">
          {isWaiterFlow && returnToWaiterHref && (
            <Link
              href={returnToWaiterHref}
              className="block text-center rounded-xl py-2 text-sm border border-brand-gold/35 bg-brand-gold/12 text-brand-gold hover:bg-brand-gold/18 transition-colors"
            >
              ← {t.backToWaiter}
            </Link>
          )}
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
      ) : (
        isWaiterFlow && returnToWaiterHref && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-mobile bottom-4">
            <Link
              href={returnToWaiterHref}
              className="block text-center rounded-xl py-2 text-sm border border-brand-gold/35 bg-brand-gold/12 text-brand-gold hover:bg-brand-gold/18 transition-colors"
            >
              ← {t.backToWaiter}
            </Link>
          </div>
        )
      )}

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
