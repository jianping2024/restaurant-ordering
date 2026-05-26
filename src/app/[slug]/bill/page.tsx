import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillPage } from '@/components/menu/BillPage';
import type { BillSplit } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table_id?: string; from?: string; return?: string }>;
}

export default async function BillRoute({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table_id: tableIdParam, from, return: returnPath } = await searchParams;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const { data: activeTables } = await supabase
    .from('restaurant_tables')
    .select('id, display_name, sort_order')
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null)
    .order('sort_order');

  const defaultTableId = activeTables?.[0]?.id;
  const requestedTableId = parseTableIdParam(tableIdParam) ?? defaultTableId;
  if (!requestedTableId) notFound();

  let tableId = requestedTableId;
  let displayName =
    activeTables?.find((t) => t.id === requestedTableId)?.display_name ?? requestedTableId.slice(0, 8);

  let { data: activeSession } = await supabase
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurant.id)
    .eq('table_id', requestedTableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSession) {
    const { data: mergedFromSession } = await supabase
      .from('table_sessions')
      .select('merge_into_session_id')
      .eq('restaurant_id', restaurant.id)
      .eq('table_id', requestedTableId)
      .eq('status', 'closed')
      .eq('closed_reason', 'merged')
      .not('merge_into_session_id', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mergedFromSession?.merge_into_session_id) {
      const { data: targetSession } = await supabase
        .from('table_sessions')
        .select('id, status, table_id')
        .eq('id', mergedFromSession.merge_into_session_id)
        .in('status', ['open', 'billing'])
        .maybeSingle();

      if (targetSession) {
        activeSession = { id: targetSession.id, status: targetSession.status };
        tableId = targetSession.table_id;
        displayName =
          activeTables?.find((t) => t.id === tableId)?.display_name ?? displayName;
      }
    }
  }

  if (!activeSession) {
    if (from === 'waiter') {
      redirect(returnPath || `/${slug}/waiter`);
    }
    redirect(`/${slug}/menu?table_id=${encodeURIComponent(tableId)}`);
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
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
      tableId={tableId}
      displayName={displayName}
      orders={orders || []}
      sessionId={activeSession.id}
      existingSplit={existingSplit}
      returnPath={from === 'waiter' ? (returnPath || `/${slug}/waiter`) : null}
      initialFeedbackSubmitted={initialFeedbackSubmitted}
      initialFeedbackSkipped={initialFeedbackSkipped}
    />
  );
}
