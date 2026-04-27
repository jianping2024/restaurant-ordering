'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { MenuItem, Category, Language, CartItem, Order, TableSession } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { CartBar } from './CartBar';
import { CartDrawer } from './CartDrawer';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS } from '@/lib/i18n/messages';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { MENU_CATEGORIES } from '@/lib/menu';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { getClientLanguage, setClientLanguage } from '@/lib/i18n';

const LANG_FLAGS: Record<Language, string> = { pt: '🇵🇹', en: '🇬🇧', zh: '🇨🇳' };
const LANG_LABELS: Record<Language, string> = { pt: 'PT', en: 'EN', zh: '中' };

interface Props {
  restaurant: { id: string; name: string; slug: string; logo_url?: string | null };
  menuItems: MenuItem[];
  tableNumber: number;
  isDemo?: boolean;
}

function deriveOrderStatusFromItems(items: Array<{ item_status?: 'pending' | 'cooking' | 'done' }>) {
  const statuses = items.map(i => i.item_status || 'pending');
  if (statuses.length > 0 && statuses.every(s => s === 'done')) return 'done' as const;
  if (statuses.some(s => s === 'cooking' || s === 'done')) return 'cooking' as const;
  return 'pending' as const;
}

function calcItemsTotal(items: Array<{ price: number | string; qty: number | string }>) {
  return items.reduce((sum, it) => {
    const price = Number(it.price) || 0;
    const qty = Number(it.qty) || 0;
    return sum + price * qty;
  }, 0);
}

export function MenuPage({ restaurant, menuItems, tableNumber, isDemo }: Props) {
  const [lang, setLang] = useState<Language>(() => getClientLanguage() as Language);
  const [activeCategory, setActiveCategory] = useState<Category>('Pratos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitSuccessText, setSubmitSuccessText] = useState('');
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

  // 加载本桌当前餐次及订单
  useEffect(() => {
    if (isDemo) return;
    const supabase = createClient();

    const loadSessionAndOrders = async () => {
      const { data: session } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNumber)
        .in('status', ['open', 'billing'])
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveSession((session as TableSession | null) || null);

      if (!session) {
        setRecentOrders([]);
        return;
      }

      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentOrders((data || []) as Order[]);
    };

    loadSessionAndOrders();
  }, [isDemo, restaurant.id, tableNumber]);

  // 当前分类菜品
  const currentItems = menuItems.filter(i => i.category === activeCategory);

  // 加入购物车
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, {
        menuItemId: item.id,
        name_pt: item.name_pt,
        name_en: item.name_en,
        name_zh: item.name_zh,
        price: item.price,
        emoji: item.emoji,
        qty: 1,
        note: '',
      }];
    });
  };

  // 更新数量
  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
    } else {
      setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, qty } : c));
    }
  };

  // 更新备注
  const updateNote = (menuItemId: string, note: string) => {
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, note } : c));
  };

  const totalQty = cart.reduce((sum, c) => sum + c.qty, 0);
  const totalPrice = calcItemsTotal(cart);
  const t = MENU_PAGE_MESSAGES[lang];
  const locale = UI_LOCALE_BY_LANG[lang];
  const { totalItemCount } = recentOrders.reduce((acc, order) => {
    acc.totalItemCount += order.items.length;
    return acc;
  }, { totalItemCount: 0 });
  // 只要本桌本餐次有下单记录，即可随时进入结账页。
  const canGoBill = !!activeSession && totalItemCount > 0;

  // 提交订单
  const submitOrder = async () => {
    if (cart.length === 0) return;

    if (isDemo) {
      setCartOpen(false);
      setDemoToast(true);
      setTimeout(() => setDemoToast(false), 3500);
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const addedAt = new Date().toISOString();
      const items = cart.map(c => ({
        id: c.menuItemId,
        name: c[`name_${lang}`] || c.name_pt,
        name_pt: c.name_pt,
        qty: c.qty,
        note: c.note || '',
        price: c.price,
        emoji: c.emoji,
        item_status: 'pending' as const,
        batch_id: batchId,
        added_at: addedAt,
      }));
      let sessionId = activeSession?.id || null;
      let sessionStatus = activeSession?.status || null;

      if (!sessionId) {
        const { data: newSession, error: sessionError } = await supabase
          .from('table_sessions')
          .insert({
            restaurant_id: restaurant.id,
            table_number: tableNumber,
            status: 'open',
          })
          .select('*')
          .single();
        if (sessionError) throw sessionError;
        sessionId = newSession.id;
        sessionStatus = 'open';
      }

      if (sessionStatus === 'billing') {
        alert(t.billDisabledHint);
        return;
      }

      // 同桌同餐次始终使用同一张订单；每次提交作为新批次追加。
      const { data: openOrder } = await supabase
        .from('orders')
        .select('id, items')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openOrder) {
        const hadDoneBefore = ((openOrder.items || []) as Array<{ item_status?: 'pending' | 'cooking' | 'done' | undefined }>)
          .every(item => (item.item_status || 'pending') === 'done');
        const mergedItems = [...((openOrder.items || []) as typeof items), ...items];
        const mergedTotal = calcItemsTotal(mergedItems);
        const mergedStatus = deriveOrderStatusFromItems(mergedItems);
        const { error } = await supabase
          .from('orders')
          .update({
            items: mergedItems,
            total_amount: mergedTotal,
            status: mergedStatus,
          })
          .eq('id', openOrder.id);
        if (error) throw error;
        setSubmitSuccessText(hadDoneBefore ? t.reOpenOrderSuccess : t.addOnOrderSuccess);
      } else {
        const { error } = await supabase.from('orders').insert({
          restaurant_id: restaurant.id,
          session_id: sessionId,
          table_number: tableNumber,
          status: 'pending',
          items,
          total_amount: totalPrice,
        });
        if (error) throw error;
        setSubmitSuccessText(t.firstOrderSuccess);
      }

      const { data: latestOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentOrders((latestOrders || []) as Order[]);
      setLatestBatchId(batchId);
      setTimeout(() => setLatestBatchId(null), 15000);

      setCart([]);
      setCartOpen(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // Keep dev diagnostics without exposing raw errors to guests.
        console.error('[MenuPage.submitOrder] failed:', error);
      }
      alert(t.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg max-w-mobile mx-auto relative pb-24">
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
              href="/auth/register"
              className="flex-shrink-0 text-[13px] bg-brand-gold text-brand-bg px-3 py-1 rounded-full font-semibold hover:bg-brand-gold-light transition-colors"
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
          <div className="bg-brand-card border border-green-500/30 rounded-2xl p-8 text-center mx-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-heading text-2xl text-green-400 mb-2">{submitSuccessText || t.orderSuccess}</h2>
            <p className="text-brand-text-muted text-sm">{t.orderReceived}</p>
          </div>
        </div>
      )}

      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur border-b border-brand-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-heading text-xl text-brand-gold">{restaurant.name}</h1>
            <p className="text-brand-text-muted text-[13px]">{t.table} {tableNumber}</p>
          </div>
          {/* 语言切换 */}
          <div className="flex items-center gap-1 bg-brand-card border border-brand-border rounded-full p-1">
            {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
              <button
                key={l}
                onClick={() => setLangAndSave(l)}
                className={`px-2.5 py-1 rounded-full text-[13px] transition-all ${
                  lang === l
                    ? 'bg-brand-gold text-brand-bg font-semibold'
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
          {MENU_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 text-sm transition-all border-b-2 ${
                activeCategory === cat
                  ? 'border-brand-gold text-brand-gold font-medium'
                  : 'border-transparent text-brand-text-muted'
              }`}
            >
              {CATEGORY_LABELS[lang][cat]}
            </button>
          ))}
        </div>
      </header>

      {/* 本桌已下单记录 */}
      <section className="px-4 pt-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
          <h2 className="font-heading text-lg text-brand-gold mb-3">{t.orderedTitle}</h2>
          {recentOrders.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{t.noOrders}</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="border border-brand-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-brand-text-muted">
                      {new Date(order.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-[13px] px-2 py-0.5 rounded-full ${
                      order.status === 'done' ? 'bg-green-400/15 text-green-400' :
                      order.status === 'cooking' ? 'bg-yellow-400/15 text-yellow-400' :
                      'bg-red-400/15 text-red-400'
                    }`}>
                      {order.status === 'done' ? t.statusDone : order.status === 'cooking' ? t.statusCooking : t.statusPending}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={`${order.id}-${idx}`} className="flex items-center justify-between gap-2">
                        <p className="text-sm text-brand-text">
                          {item.emoji} {(item.name || item.name_pt)} x {item.qty}
                        </p>
                        {latestBatchId && item.batch_id === latestBatchId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-semibold">
                            {t.newTag}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-brand-border">
            <Link
              href={`/${restaurant.slug}/bill?table=${tableNumber}`}
              aria-disabled={!canGoBill}
              className={`w-full block text-center rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                canGoBill
                  ? 'bg-brand-gold text-brand-bg hover:bg-brand-gold-light'
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
              cartQty={cart.find(c => c.menuItemId === item.id)?.qty || 0}
              onAdd={() => addToCart(item)}
            />
          ))
        )}
      </div>

      {/* 购物车底栏 */}
      {totalQty > 0 && (
        <CartBar
          qty={totalQty}
          total={totalPrice}
          label={t.viewCart}
          onClick={() => setCartOpen(true)}
        />
      )}

      {/* 购物车抽屉 */}
      <CartDrawer
        open={cartOpen}
        cart={cart}
        lang={lang}
        total={totalPrice}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateQty}
        onUpdateNote={updateNote}
        onSubmit={submitOrder}
        submitting={submitting}
      />
    </div>
  );
}
