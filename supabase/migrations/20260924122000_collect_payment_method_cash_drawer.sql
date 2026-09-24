-- Collect payment: persist payment_method on ledger; hang-queue cash drawer for CASH only.

ALTER TABLE public.session_collected_payments
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.session_collected_payments
  DROP CONSTRAINT IF EXISTS session_collected_payments_payment_method_check;

ALTER TABLE public.session_collected_payments
  ADD CONSTRAINT session_collected_payments_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method = ANY (ARRAY[
      'CASH'::text,
      'CARD'::text,
      'MBWAY'::text,
      'MULTIBANCO'::text,
      'MIXED'::text,
      'OTHER'::text
    ])
  );

COMMENT ON COLUMN public.session_collected_payments.payment_method IS
  'Tender at confirm-payment (BillSyncPaymentMethod). Null = legacy rows.';

-- Cash drawer open hang-queue (Farvoo→fiscal Agent; short TTL).
CREATE TABLE IF NOT EXISTS public.cash_drawer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.table_sessions (id) ON DELETE SET NULL,
  collected_payment_id uuid REFERENCES public.session_collected_payments (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'processing'::text,
      'succeeded'::text,
      'failed'::text,
      'expired'::text
    ])),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS cash_drawer_jobs_restaurant_status_created_idx
  ON public.cash_drawer_jobs (restaurant_id, status, created_at);

ALTER TABLE public.cash_drawer_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_drawer_jobs_print_agent_select" ON public.cash_drawer_jobs;
CREATE POLICY "cash_drawer_jobs_print_agent_select"
  ON public.cash_drawer_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_restaurant_staff(restaurant_id, ARRAY['print_agent'::text])
  );

COMMENT ON TABLE public.cash_drawer_jobs IS
  'Short-TTL hang-queue: CASH collect → Agent kick via CashDrawerKickBytes; never blocks payment.';

ALTER TABLE public.cash_drawer_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'cash_drawer_jobs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_drawer_jobs;
    END IF;
  END IF;
END $$;

-- Replace confirm RPC: require/store payment_method (6th arg).
DROP FUNCTION IF EXISTS public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid);

CREATE OR REPLACE FUNCTION public.confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index integer,
  p_collected_amount numeric default null,
  p_created_by_user_id uuid default null,
  p_payment_method text default null
) returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_split public.bill_splits%rowtype;
  v_raw_result jsonb;
  v_base_rows jsonb;
  v_next_result jsonb;
  v_row jsonb;
  v_all_paid boolean := true;
  v_final_amount numeric := 0;
  v_i integer;
  v_len integer;
  v_session public.table_sessions%rowtype;
  v_session_id uuid;
  v_precheck_status text;
  v_obligation numeric;
  v_collected numeric;
  v_prior_collected numeric;
  v_outstanding numeric;
  v_person_name text;
  v_payment_id uuid;
  v_payment_method text;
begin
  if p_person_index is null or p_person_index < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  v_payment_method := upper(trim(coalesce(p_payment_method, '')));
  if v_payment_method = '' then
    return jsonb_build_object('ok', false, 'code', 'missing_payment_method');
  end if;
  if v_payment_method not in ('CASH', 'CARD', 'MBWAY', 'MULTIBANCO', 'MIXED', 'OTHER') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payment_method');
  end if;

  select session_id, status
  into v_session_id, v_precheck_status
  from public.bill_splits
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'bill_split_not_found');
  end if;

  if v_precheck_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'bill_split_cancelled');
  end if;

  if v_session_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_session_id::text));
  end if;

  select *
  into v_split
  from public.bill_splits
  where id = p_bill_split_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'bill_split_not_found');
  end if;

  if v_split.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'bill_split_cancelled');
  end if;

  v_raw_result := coalesce(v_split.result, '[]'::jsonb);
  if jsonb_typeof(v_raw_result) <> 'array' then
    v_raw_result := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_raw_result) = 0 then
    if coalesce(v_split.total_amount, 0) > 0 then
      v_base_rows := jsonb_build_array(
        jsonb_build_object('name', 'Total', 'amount', v_split.total_amount)
      );
    else
      return jsonb_build_object('ok', false, 'code', 'empty_split');
    end if;
  else
    v_base_rows := v_raw_result;
  end if;

  v_len := jsonb_array_length(v_base_rows);
  if p_person_index >= v_len then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_index');
  end if;

  v_row := v_base_rows -> p_person_index;
  v_person_name := coalesce(v_row ->> 'name', '');
  v_obligation := public.checkout_round_discount_amount(
    coalesce((v_row ->> 'amount')::numeric, 0),
    v_split.discount_rate
  );

  if v_split.session_id is not null then
    v_prior_collected := public.session_person_collected_by_index(
      p_restaurant_id,
      v_split.session_id,
      p_person_index
    );
  else
    v_prior_collected := 0;
  end if;

  v_outstanding := round(v_obligation - v_prior_collected, 2);
  if v_outstanding <= 0 then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  v_collected := coalesce(p_collected_amount, v_outstanding);
  if v_collected <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_collected_amount');
  end if;

  if round(v_collected, 2) > round(v_outstanding, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid_collected_amount');
  end if;

  if v_split.session_id is not null then
    insert into public.session_collected_payments (
      restaurant_id,
      session_id,
      person_index,
      person_name,
      amount,
      bill_split_id,
      created_by_user_id,
      payment_method
    ) values (
      p_restaurant_id,
      v_split.session_id,
      p_person_index,
      v_person_name,
      v_collected,
      p_bill_split_id,
      p_created_by_user_id,
      v_payment_method
    )
    returning id into v_payment_id;
  end if;

  v_next_result := public.reconcile_split_result_paid_from_ledger(
    v_base_rows,
    p_restaurant_id,
    v_split.session_id,
    v_split.discount_rate
  );

  for v_i in 0 .. v_len - 1 loop
    if not coalesce((v_next_result -> v_i ->> 'paid')::boolean, false) then
      v_all_paid := false;
      exit;
    end if;
  end loop;

  if v_all_paid and v_split.session_id is not null then
    v_final_amount := public.session_total_collected(
      p_restaurant_id,
      v_split.session_id
    );
  else
    select coalesce(sum((elem->>'amount')::numeric), 0)
    into v_final_amount
    from jsonb_array_elements(v_base_rows) as elem;
  end if;

  update public.bill_splits
  set
    status = case when v_all_paid then 'paid' else 'requested' end,
    total_amount = case when v_all_paid then v_split.total_amount else v_split.total_amount end,
    result = v_next_result
  where id = p_bill_split_id;

  v_row := v_next_result -> p_person_index;

  if v_all_paid and v_split.session_id is not null then
    select *
    into v_session
    from public.table_sessions
    where id = v_split.session_id
    for update;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'session_close_failed',
        'message', 'session not found'
      );
    end if;

    if v_session.status = 'closed' then
      return jsonb_build_object(
        'ok', false,
        'code', 'session_close_failed',
        'message', 'session already closed'
      );
    end if;

    update public.table_sessions
    set status = 'closed',
        closed_at = now(),
        closed_by_user_id = p_created_by_user_id
    where id = v_split.session_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'all_paid', v_all_paid,
    'result', v_next_result,
    'final_amount', v_final_amount,
    'session_id', v_split.session_id,
    'table_id', v_split.table_id,
    'display_name', v_split.display_name,
    'order_ids', coalesce(to_jsonb(v_split.order_ids), '[]'::jsonb),
    'row_name', v_row ->> 'name',
    'row_amount', v_collected,
    'collected_payment_id', v_payment_id,
    'confirmed_person_index', p_person_index,
    'payment_method', v_payment_method,
    'newly_paid', true,
    'should_print_split',
      v_split.session_id is not null and v_len > 1,
    'should_print_final',
      v_all_paid and v_split.session_id is not null,
    'should_close_session',
      v_all_paid and v_split.session_id is not null
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'code', 'bill_update_failed',
      'message', sqlerrm
    );
end;
$$;

revoke all on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid, text) from public;
grant execute on function public.confirm_bill_split_payment(uuid, uuid, integer, numeric, uuid, text) to authenticated, service_role;
