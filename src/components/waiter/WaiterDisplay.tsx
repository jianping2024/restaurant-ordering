'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';

interface Props {
  restaurant: { id: string; name: string; slug: string; waiter_password: string };
  initialOrders: Order[];
  isDemo?: boolean;
}

const WAITER_TEXT = {
  zh: {
    demoTitle: '演示服务员看板',
    regularTitle: '服务员观察入口',
    passwordLabel: '访问密码（4位数字）',
    wrongPassword: '密码错误，请重试',
    enterRegular: '进入观察页',
    enterDemo: '进入演示看板',
    passwordHint: '演示密码',
    step: '第 3/3 步：服务员查看可端菜桌台和服务优先级。',
    openCustomer: '打开顾客视图',
    openKitchen: '打开后厨视图',
    backHub: '返回演示首页',
    boardTitle: '服务员出餐观察看板',
    empty: '当前没有活跃桌台',
    table: '桌',
    pending: '待做',
    cooking: '制作中',
    ready: '可端菜',
    noReady: '暂无可端菜品',
  },
  en: {
    demoTitle: 'Demo waiter dashboard',
    regularTitle: 'Waiter access',
    passwordLabel: 'Access password (4 digits)',
    wrongPassword: 'Wrong password, please retry',
    enterRegular: 'Enter dashboard',
    enterDemo: 'Enter demo dashboard',
    passwordHint: 'Demo password',
    step: 'Step 3/3: waiter reviews ready-to-serve tables and priorities.',
    openCustomer: 'Open customer view',
    openKitchen: 'Open kitchen view',
    backHub: 'Back to demo hub',
    boardTitle: 'Waiter service board',
    empty: 'No active tables currently',
    table: 'Table',
    pending: 'Pending',
    cooking: 'Cooking',
    ready: 'Ready',
    noReady: 'No ready items yet',
  },
  pt: {
    demoTitle: 'Painel demo do garcom',
    regularTitle: 'Entrada do garcom',
    passwordLabel: 'Senha de acesso (4 digitos)',
    wrongPassword: 'Senha incorreta, tente novamente',
    enterRegular: 'Entrar no painel',
    enterDemo: 'Entrar no painel demo',
    passwordHint: 'Senha demo',
    step: 'Passo 3/3: o garcom verifica mesas prontas e prioridades.',
    openCustomer: 'Abrir visao do cliente',
    openKitchen: 'Abrir visao da cozinha',
    backHub: 'Voltar ao hub demo',
    boardTitle: 'Painel de servico do garcom',
    empty: 'Sem mesas ativas no momento',
    table: 'Mesa',
    pending: 'Pendente',
    cooking: 'Em preparo',
    ready: 'Pronto',
    noReady: 'Sem itens prontos no momento',
  },
} as const;

function itemStatus(item: OrderItem, orderStatus: Order['status']) {
  if (item.item_status) return item.item_status;
  if (orderStatus === 'done') return 'done';
  if (orderStatus === 'cooking') return 'cooking';
  return 'pending';
}

export function WaiterDisplay({ restaurant, initialOrders, isDemo = false }: Props) {
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const [authenticated, setAuthenticated] = useState(isDemo);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState(false);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const supabase = createClient();

  const tableCards = useMemo(() => {
    const grouped = new Map<number, { pending: number; cooking: number; ready: number; readyItems: string[]; updatedAt: string }>();

    orders.forEach((order) => {
      const current = grouped.get(order.table_number) || {
        pending: 0,
        cooking: 0,
        ready: 0,
        readyItems: [],
        updatedAt: order.updated_at || order.created_at,
      };

      order.items.forEach((item) => {
        const status = itemStatus(item, order.status);
        if (status === 'pending') current.pending += item.qty;
        if (status === 'cooking') current.cooking += item.qty;
        if (status === 'done') {
          current.ready += item.qty;
          current.readyItems.push(`${item.emoji} ${item.name || item.name_pt} × ${item.qty}`);
        }
      });

      if ((order.updated_at || order.created_at) > current.updatedAt) {
        current.updatedAt = order.updated_at || order.created_at;
      }

      grouped.set(order.table_number, current);
    });

    return Array.from(grouped.entries())
      .map(([table, data]) => ({ table, ...data }))
      .sort((a, b) => a.table - b.table);
  }, [orders]);

  useEffect(() => {
    if (!authenticated || isDemo) return;

    const channel = supabase
      .channel(`waiter-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, async () => {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .in('status', ['pending', 'cooking', 'done'])
          .order('updated_at', { ascending: false })
          .limit(200);
        setOrders((data || []) as Order[]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authenticated, isDemo, restaurant.id, supabase]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === restaurant.waiter_password) {
      setAuthenticated(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPassword('');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-end mb-3">
            <LanguageSwitcher compact />
          </div>
          <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">{isDemo ? t.demoTitle : t.regularTitle}</h1>
          <p className="text-brand-text-muted text-sm text-center mb-6">{restaurant.name}</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-brand-text-muted block mb-1.5">{t.passwordLabel}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={e => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-brand-text focus:outline-none focus:border-brand-gold/50"
                placeholder="••••"
                autoFocus
              />
            </div>
            {pwError && <p className="text-red-400 text-sm text-center">{t.wrongPassword}</p>}
            <button
              type="submit"
              className="w-full bg-brand-gold text-brand-bg py-3 rounded-xl font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {isDemo ? t.enterDemo : t.enterRegular}
            </button>
          </form>
          {isDemo && (
            <p className="mt-3 text-center text-[13px] text-brand-text-muted">
              {t.passwordHint} <span className="text-brand-gold font-semibold">0000</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg p-4">
      {isDemo && (
        <div className="mb-4 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
          <p className="text-[13px] text-brand-text">
            {t.step}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.openCustomer}
            </Link>
            <Link
              href="/demo/kitchen"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.openKitchen}
            </Link>
            <Link
              href="/demo"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.backHub}
            </Link>
          </div>
        </div>
      )}
      <div className="mb-6">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher compact />
        </div>
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
      </div>

      {tableCards.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center text-brand-text-muted">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableCards.map(card => (
            <div key={card.table} className="bg-brand-card border border-brand-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-2xl text-brand-text">{t.table} {card.table}</h2>
                <span className="text-[13px] text-brand-text-muted">
                  {new Date(card.updatedAt).toLocaleString(locale, {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[13px] mb-3">
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{t.pending} {card.pending}</span>
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{t.cooking} {card.cooking}</span>
                <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{t.ready} {card.ready}</span>
              </div>

              <div className="space-y-1.5">
                {card.readyItems.length === 0 ? (
                  <p className="text-brand-text-muted text-sm">{t.noReady}</p>
                ) : (
                  card.readyItems.slice(0, 6).map((line, idx) => (
                    <p key={idx} className="text-sm text-green-300">{line}</p>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
