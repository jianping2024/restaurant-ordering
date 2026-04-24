'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem } from '@/types';

interface Props {
  restaurant: { id: string; name: string; slug: string; waiter_password: string };
  initialOrders: Order[];
}

function itemStatus(item: OrderItem, orderStatus: Order['status']) {
  if (item.item_status) return item.item_status;
  if (orderStatus === 'done') return 'done';
  if (orderStatus === 'cooking') return 'cooking';
  return 'pending';
}

export function WaiterDisplay({ restaurant, initialOrders }: Props) {
  const [authenticated, setAuthenticated] = useState(false);
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
          current.readyItems.push(`${item.emoji} ${item.name_pt} x ${item.qty}`);
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
    if (!authenticated) return;

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
  }, [authenticated, restaurant.id, supabase]);

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
          <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">服务员观察入口</h1>
          <p className="text-brand-text-muted text-sm text-center mb-6">{restaurant.name}</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-brand-text-muted block mb-1.5">访问密码（4位数字）</label>
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
            {pwError && <p className="text-red-400 text-sm text-center">密码错误，请重试</p>}
            <button
              type="submit"
              className="w-full bg-brand-gold text-brand-bg py-3 rounded-xl font-semibold hover:bg-brand-gold-light transition-colors"
            >
              进入观察页
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg p-4">
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">服务员出餐观察看板</p>
      </div>

      {tableCards.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center text-brand-text-muted">
          当前没有活跃桌台
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableCards.map(card => (
            <div key={card.table} className="bg-brand-card border border-brand-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-2xl text-brand-text">桌 {card.table}</h2>
                <span className="text-[13px] text-brand-text-muted">
                  {new Date(card.updatedAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[13px] mb-3">
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">待做 {card.pending}</span>
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">制作中 {card.cooking}</span>
                <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">可端菜 {card.ready}</span>
              </div>

              <div className="space-y-1.5">
                {card.readyItems.length === 0 ? (
                  <p className="text-brand-text-muted text-sm">暂无可端菜品</p>
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
