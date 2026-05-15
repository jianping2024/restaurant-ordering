import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillPage } from '@/components/menu/BillPage';
import type { BillSplit } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string; from?: string; return?: string }>;
}

export default async function BillRoute({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table, from, return: returnPath } = await searchParams;
  const requestedTableNumber = parseInt(table || '1', 10) || 1;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  let tableNumber = requestedTableNumber;

  let { data: activeSession } = await supabase
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', requestedTableNumber)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSession) {
    const { data: mergedFromSession } = await supabase
      .from('table_sessions')
      .select('merge_into_session_id')
      .eq('restaurant_id', restaurant.id)
      .eq('table_number', requestedTableNumber)
      .eq('status', 'closed')
      .eq('closed_reason', 'merged')
      .not('merge_into_session_id', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mergedFromSession?.merge_into_session_id) {
      const { data: targetSession } = await supabase
        .from('table_sessions')
        .select('id, status, table_number')
        .eq('id', mergedFromSession.merge_into_session_id)
        .in('status', ['open', 'billing'])
        .maybeSingle();

      if (targetSession) {
        activeSession = { id: targetSession.id, status: targetSession.status };
        tableNumber = targetSession.table_number;
      }
    }
  }

  // 关台后（无 open/billing 餐次）按来源回退：服务员入口回服务员页，顾客入口回点餐页。
  if (!activeSession) {
    if (from === 'waiter') {
      redirect(returnPath || `/${slug}/waiter`);
    }
    redirect(`/${slug}/menu?table=${tableNumber}`);
  }

  // 查询当前餐次订单。账单页会按“菜品级 done 状态”过滤可结算菜品。
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNumber)
    .eq('session_id', activeSession.id)
    .order('created_at', { ascending: true });

  let existingSplit: BillSplit | null = null;
  const { data } = await supabase
    .from('bill_splits')
    .select('*')
    .eq('session_id', activeSession.id)
    .in('status', ['requested', 'confirmed', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  existingSplit = (data as BillSplit | null) || null;

  let initialFeedbackSubmitted = false;
  let initialFeedbackSkipped = false;
  if (activeSession?.id) {
    const { data: feedbackSession } = await supabase
      .from('feedback_sessions')
      .select('completed_at, skipped_at')
      .eq('session_id', activeSession.id)
      .maybeSingle();
    initialFeedbackSubmitted = !!feedbackSession?.completed_at;
    initialFeedbackSkipped = !!feedbackSession?.skipped_at;
  }

  return (
    <BillPage
      restaurant={restaurant}
      tableNumber={tableNumber}
      orders={orders || []}
      sessionId={activeSession.id}
      existingSplit={existingSplit}
      returnPath={from === 'waiter' ? (returnPath || `/${slug}/waiter`) : null}
      initialFeedbackSubmitted={initialFeedbackSubmitted}
      initialFeedbackSkipped={initialFeedbackSkipped}
    />
  );
}
