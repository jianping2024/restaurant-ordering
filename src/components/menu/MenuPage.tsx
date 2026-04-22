'use client';

import { useState, useEffect } from 'react';
import type { MenuItem, Category, Language, CartItem, Order } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { CartBar } from './CartBar';
import { CartDrawer } from './CartDrawer';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS } from '@/lib/i18n/messages';
import { MENU_CATEGORIES } from '@/lib/menu';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

const LANG_FLAGS: Record<Language, string> = { pt: '🇵🇹', en: '🇬🇧', zh: '🇨🇳' };
const LANG_LABELS: Record<Language, string> = { pt: 'PT', en: 'EN', zh: '中' };

interface Props {
  restaurant: { id: string; name: string; slug: string; logo_url?: string | null };
  menuItems: MenuItem[];
  tableNumber: number;
  isDemo?: boolean;
}

export function MenuPage({ restaurant, menuItems, tableNumber, isDemo }: Props) {
  const [lang, setLang] = useState<Language>('pt');
  const [activeCategory, setActiveCategory] = useState<Category>('Pratos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [demoToast, setDemoToast] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  // 从 localStorage 恢复语言设置
  useEffect(() => {
    const saved = localStorage.getItem('mesa-lang') as Language;
    if (saved && ['pt', 'en', 'zh'].includes(saved)) setLang(saved);
  }, []);

  const setLangAndSave = (l: Language) => {
    setLang(l);
    localStorage.setItem('mesa-lang', l);
  };

  // 加载本桌订单记录，刷新后顾客也能看到已下单内容。
  useEffect(() => {
    if (isDemo) return;
    const supabase = createClient();

    const loadOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNumber)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentOrders((data || []) as Order[]);
    };

    loadOrders();
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
  const totalPrice = cart.reduce((sum, c) => sum + c.qty * c.price, 0);
  const t = MENU_PAGE_MESSAGES[lang];

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
      const items = cart.map(c => ({
        id: c.menuItemId,
        name: c[`name_${lang}`] || c.name_pt,
        name_pt: c.name_pt,
        qty: c.qty,
        note: c.note || '',
        price: c.price,
        emoji: c.emoji,
        item_status: 'pending' as const,
      }));
      // 每次提交都新建一张订单（厨房按单出餐，避免旧菜被重复处理）。
      const { error } = await supabase.from('orders').insert({
        restaurant_id: restaurant.id,
        table_number: tableNumber,
        status: 'pending',
        items,
        total_amount: totalPrice,
      });

      if (error) throw error;

      const { data: latestOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNumber)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentOrders((latestOrders || []) as Order[]);

      setCart([]);
      setCartOpen(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      alert('提交失败，请重试');
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
            <p className="text-brand-text-muted text-xs">{t.demoToastDesc}</p>
          </div>
        </div>
      )}

      {/* Demo 顶部 banner */}
      {isDemo && (
        <div className="bg-brand-gold/10 border-b border-brand-gold/30 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-brand-gold text-xs">{t.demoMode}</p>
          <a
            href="/auth/register"
            className="flex-shrink-0 text-xs bg-brand-gold text-brand-bg px-3 py-1 rounded-full font-semibold hover:bg-brand-gold-light transition-colors"
          >
            {t.freeSignup}
          </a>
        </div>
      )}

      {/* 成功提示 */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-brand-card border border-green-500/30 rounded-2xl p-8 text-center mx-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-heading text-2xl text-green-400 mb-2">{t.orderSuccess}</h2>
            <p className="text-brand-text-muted text-sm">{t.orderReceived}</p>
          </div>
        </div>
      )}

      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur border-b border-brand-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-heading text-xl text-brand-gold">{restaurant.name}</h1>
            <p className="text-brand-text-muted text-xs">{t.table} {tableNumber}</p>
          </div>
          {/* 语言切换 */}
          <div className="flex items-center gap-1 bg-brand-card border border-brand-border rounded-full p-1">
            {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
              <button
                key={l}
                onClick={() => setLangAndSave(l)}
                className={`px-2.5 py-1 rounded-full text-xs transition-all ${
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
                    <span className="text-xs text-brand-text-muted">
                      {new Date(order.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'done' ? 'bg-green-400/15 text-green-400' :
                      order.status === 'cooking' ? 'bg-yellow-400/15 text-yellow-400' :
                      'bg-red-400/15 text-red-400'
                    }`}>
                      {order.status === 'done' ? t.statusDone : order.status === 'cooking' ? t.statusCooking : t.statusPending}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <p key={`${order.id}-${idx}`} className="text-sm text-brand-text">
                        {item.emoji} {item.name_pt} x {item.qty}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
