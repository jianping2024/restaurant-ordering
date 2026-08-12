-- Sushi table order rounds: shared free-dish basket + confirm-to-kitchen.
-- Contract: docs/product/sushi-round-ordering.zh.md

-- ---------------------------------------------------------------------------
-- Restaurant settings (sushi round)
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS sushi_round_ordering_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sushi_per_person_per_round_cap integer NOT NULL DEFAULT 8
    CONSTRAINT restaurants_sushi_per_person_per_round_cap_range CHECK (
      sushi_per_person_per_round_cap BETWEEN 1 AND 20
    ),
  ADD COLUMN IF NOT EXISTS sushi_round_confirm_timeout_seconds integer NOT NULL DEFAULT 25
    CONSTRAINT restaurants_sushi_round_confirm_timeout_range CHECK (
      sushi_round_confirm_timeout_seconds BETWEEN 15 AND 45
    ),
  ADD COLUMN IF NOT EXISTS sushi_round_cooldown_seconds integer NOT NULL DEFAULT 120
    CONSTRAINT restaurants_sushi_round_cooldown_range CHECK (
      sushi_round_cooldown_seconds BETWEEN 30 AND 600
    ),
  ADD COLUMN IF NOT EXISTS sushi_round_defer_cooldown_seconds integer NOT NULL DEFAULT 30
    CONSTRAINT restaurants_sushi_round_defer_cooldown_range CHECK (
      sushi_round_defer_cooldown_seconds BETWEEN 15 AND 120
    ),
  ADD COLUMN IF NOT EXISTS sushi_round_rules_notice jsonb;

COMMENT ON COLUMN public.restaurants.sushi_round_ordering_enabled IS
  'When buffet_service_mode=sushi: enable table order rounds. Classic ignores.';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.table_order_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions (id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables (id),
  status text NOT NULL
    CONSTRAINT table_order_rounds_status_check CHECK (
      status IN ('collecting', 'pending_confirm', 'cooldown', 'closed', 'finalize_failed')
    ),
  guest_count_snapshot integer NOT NULL DEFAULT 0,
  per_person_cap integer NOT NULL DEFAULT 8,
  submit_request_id uuid,
  submit_requested_at timestamptz,
  submit_deadline_at timestamptz,
  defer_used_at timestamptz,
  defer_cooldown_until timestamptz,
  cooldown_until timestamptz,
  append_client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_table_order_rounds_active_session
  ON public.table_order_rounds (session_id)
  WHERE status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed');

CREATE INDEX IF NOT EXISTS idx_table_order_rounds_restaurant_session
  ON public.table_order_rounds (restaurant_id, session_id);

CREATE TABLE IF NOT EXISTS public.table_order_round_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.table_order_rounds (id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items (id),
  qty integer NOT NULL CHECK (qty >= 1),
  guest_client_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, menu_item_id, guest_client_id)
);

CREATE INDEX IF NOT EXISTS idx_table_order_round_lines_round
  ON public.table_order_round_lines (round_id);

CREATE TABLE IF NOT EXISTS public.table_order_round_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.table_order_rounds (id) ON DELETE CASCADE,
  submit_request_id uuid NOT NULL,
  guest_client_id uuid NOT NULL,
  vote text NOT NULL DEFAULT 'pending'
    CONSTRAINT table_order_round_votes_vote_check CHECK (
      vote IN ('pending', 'confirm', 'defer')
    ),
  voted_at timestamptz,
  UNIQUE (round_id, submit_request_id, guest_client_id)
);

CREATE INDEX IF NOT EXISTS idx_table_order_round_votes_round
  ON public.table_order_round_votes (round_id, submit_request_id);

CREATE TABLE IF NOT EXISTS public.table_order_round_clients (
  session_id uuid NOT NULL REFERENCES public.table_sessions (id) ON DELETE CASCADE,
  guest_client_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, guest_client_id)
);

CREATE INDEX IF NOT EXISTS idx_table_order_round_clients_session
  ON public.table_order_round_clients (session_id, registered_at);

-- ---------------------------------------------------------------------------
-- RLS: guest reads via open/billing session; writes only service_role (API)
-- ---------------------------------------------------------------------------
ALTER TABLE public.table_order_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_order_round_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_order_round_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_order_round_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY table_order_rounds_select_open_session
  ON public.table_order_rounds
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_sessions s
      WHERE s.id = table_order_rounds.session_id
        AND s.status IN ('open', 'billing')
    )
  );

CREATE POLICY table_order_round_lines_select_open_session
  ON public.table_order_round_lines
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_order_rounds r
      JOIN public.table_sessions s ON s.id = r.session_id
      WHERE r.id = table_order_round_lines.round_id
        AND s.status IN ('open', 'billing')
    )
  );

CREATE POLICY table_order_round_votes_select_open_session
  ON public.table_order_round_votes
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_order_rounds r
      JOIN public.table_sessions s ON s.id = r.session_id
      WHERE r.id = table_order_round_votes.round_id
        AND s.status IN ('open', 'billing')
    )
  );

-- No anon/auth write policies — Next.js admin/service_role only.

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.table_order_rounds;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.table_order_round_lines;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.table_order_round_votes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- transfer / merge: same-TX round handling (bodies from 20260727143000 + patches)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transfer_table_session(
  p_restaurant_id uuid,
  p_from_table_id uuid,
  p_to_table_id uuid,
  p_operator_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_source_session public.table_sessions%rowtype;
  v_target_session_id uuid;
  v_target_display text;
  v_from_display text;
  v_operator_id uuid;
BEGIN
  v_operator_id := coalesce(p_operator_user_id, auth.uid());
  PERFORM public.assert_restaurant_session_operator(p_restaurant_id, v_operator_id);

  IF p_from_table_id = p_to_table_id THEN
    RAISE EXCEPTION 'source and target table cannot be the same';
  END IF;

  SELECT display_name INTO v_target_display
  FROM public.get_active_restaurant_table(p_restaurant_id, p_to_table_id);
  IF v_target_display IS NULL THEN
    RAISE EXCEPTION 'invalid target table';
  END IF;

  SELECT display_name INTO v_from_display
  FROM public.get_active_restaurant_table(p_restaurant_id, p_from_table_id);
  IF v_from_display IS NULL THEN
    RAISE EXCEPTION 'invalid source table';
  END IF;

  SELECT *
  INTO v_source_session
  FROM public.table_sessions
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_from_table_id
    AND status IN ('open', 'billing')
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'source table has no active session';
  END IF;

  SELECT id
  INTO v_target_session_id
  FROM public.table_sessions
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_to_table_id
    AND status IN ('open', 'billing')
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_target_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'target table already has active session';
  END IF;

  UPDATE public.table_sessions
  SET table_id = p_to_table_id
  WHERE id = v_source_session.id;

  UPDATE public.orders
  SET table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_from_table_id
    AND status IN ('pending', 'cooking', 'done')
    AND (session_id IS NULL OR session_id = v_source_session.id);

  UPDATE public.bill_splits
  SET table_id = p_to_table_id,
      display_name = v_target_display,
      session_id = coalesce(session_id, v_source_session.id)
  WHERE restaurant_id = p_restaurant_id
    AND table_id = p_from_table_id
    AND status IN ('pending', 'confirmed', 'requested')
    AND (session_id IS NULL OR session_id = v_source_session.id);

  UPDATE public.table_order_rounds
  SET table_id = p_to_table_id,
      updated_at = now()
  WHERE session_id = v_source_session.id
    AND status IN ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed');

  INSERT INTO public.table_session_events (
    restaurant_id,
    session_id,
    event_type,
    occurred_at,
    operator_user_id,
    from_table_id,
    to_table_id,
    from_display_name,
    to_display_name
  ) VALUES (
    p_restaurant_id,
    v_source_session.id,
    'transfer',
    now(),
    v_operator_id,
    p_from_table_id,
    p_to_table_id,
    v_from_display,
    v_target_display
  );

  RETURN v_source_session.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_table_sessions(
  p_restaurant_id uuid,
  p_source_table_id uuid,
  p_target_table_id uuid,
  p_operator_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $_$
declare
  v_source_session public.table_sessions%rowtype;
  v_target_session public.table_sessions%rowtype;
  v_source_split public.bill_splits%rowtype;
  v_target_split public.bill_splits%rowtype;
  v_target_display text;
  v_buffet_id uuid;
  v_buffet_name text;
  v_distinct_buffets int;
  v_adults int := 0;
  v_children int := 0;
  v_adult_price numeric;
  v_child_price numeric;
  v_rule_id uuid;
  v_line_total numeric;
  v_carrier_order_id uuid;
  v_carrier_items jsonb;
  v_merged_line jsonb;
  v_now text;
  v_new_items jsonb;
  v_new_total numeric;
  v_order_rec record;
  v_operator_id uuid;
begin
  v_operator_id := coalesce(p_operator_user_id, auth.uid());
  perform public.assert_restaurant_session_operator(p_restaurant_id, v_operator_id);

  if p_source_table_id = p_target_table_id then
    raise exception 'source and target table cannot be the same';
  end if;

  select display_name into v_target_display
  from public.get_active_restaurant_table(p_restaurant_id, p_target_table_id);
  if v_target_display is null then
    raise exception 'invalid target table';
  end if;

  select *
  into v_source_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'source table has no active session';
  end if;

  select *
  into v_target_session
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('open', 'billing')
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'target table has no active session';
  end if;

  update public.bill_splits
  set session_id = v_source_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_source_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.bill_splits
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and table_id = p_target_table_id
    and status in ('pending', 'confirmed', 'requested')
    and session_id is null;

  update public.orders
  set session_id = v_target_session.id
  where restaurant_id = p_restaurant_id
    and status in ('pending', 'cooking', 'done')
    and (
      session_id = v_source_session.id
      or (
        table_id = p_source_table_id
        and (session_id is null or session_id = v_source_session.id)
      )
    );

  select
    count(distinct bl.buffet_id),
    (min(bl.buffet_id::text))::uuid,
    coalesce(sum(bl.adults), 0)::int,
    coalesce(sum(bl.children), 0)::int
  into v_distinct_buffets, v_buffet_id, v_adults, v_children
  from (
    select
      (el->>'buffet_id')::uuid as buffet_id,
      coalesce((el->>'adult_count')::int, 0) as adults,
      coalesce((el->>'child_count')::int, 0) as children
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) el
    where o.restaurant_id = p_restaurant_id
      and o.session_id = v_target_session.id
      and o.status in ('pending', 'cooking', 'done')
      and el->>'kind' = 'buffet_base'
      and coalesce(el->>'item_status', 'pending') <> 'voided'
      and el ? 'buffet_id'
      and (el->>'buffet_id') ~* '^[0-9a-f-]{36}$'
  ) bl;

  if coalesce(v_distinct_buffets, 0) > 1 then
    raise exception 'multiple buffet types cannot be merged';
  end if;

  if v_buffet_id is not null and (v_adults + v_children) > 0 then
    for v_order_rec in
      select o.id, o.items
      from public.orders o
      where o.restaurant_id = p_restaurant_id
        and o.session_id = v_target_session.id
        and o.status in ('pending', 'cooking', 'done')
    loop
      v_new_items := public.void_active_buffet_lines_in_items(v_order_rec.items);
      v_new_total := public.recalc_order_total_from_items(v_new_items);
      update public.orders
      set items = v_new_items,
          total_amount = v_new_total
      where id = v_order_rec.id;
    end loop;

    select r.adult_price, r.child_price, r.rule_id
    into v_adult_price, v_child_price, v_rule_id
    from public.resolve_buffet_prices(p_restaurant_id, v_buffet_id, now()) r
    limit 1;

    if v_adult_price is null or v_child_price is null then
      raise exception 'no buffet price rule at merge time';
    end if;

    select b.name into v_buffet_name
    from public.buffets b
    where b.id = v_buffet_id
      and b.restaurant_id = p_restaurant_id;

    v_line_total := v_adults * v_adult_price + v_children * v_child_price;
    v_now := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    v_merged_line := jsonb_build_object(
      'id', 'buffet:' || v_buffet_id::text,
      'kind', 'buffet_base',
      'name', coalesce(v_buffet_name, 'Buffet'),
      'name_pt', coalesce(v_buffet_name, 'Buffet'),
      'qty', 1,
      'price', v_line_total,
      'emoji', '🍽️',
      'item_status', 'done',
      'buffet_id', v_buffet_id::text,
      'adult_count', v_adults,
      'child_count', v_children,
      'adult_unit_price', v_adult_price,
      'child_unit_price', v_child_price,
      'price_rule_id', v_rule_id::text,
      'added_at', v_now,
      'batch_id', '__buffet__'
    );

    select o.id, o.items
    into v_carrier_order_id, v_carrier_items
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.session_id = v_target_session.id
      and o.status in ('pending', 'cooking', 'done')
    order by (o.table_id = p_target_table_id) desc, o.created_at desc
    limit 1;

    if v_carrier_order_id is null then
      insert into public.orders (
        restaurant_id,
        session_id,
        table_id,
        display_name,
        status,
        items,
        total_amount
      )
      values (
        p_restaurant_id,
        v_target_session.id,
        p_target_table_id,
        v_target_display,
        'done',
        jsonb_build_array(v_merged_line),
        v_line_total
      );
    else
      v_new_items := coalesce(v_carrier_items, '[]'::jsonb) || v_merged_line;
      v_new_total := public.recalc_order_total_from_items(v_new_items);
      update public.orders
      set items = v_new_items,
          total_amount = v_new_total,
          status = case
            when exists (
              select 1
              from jsonb_array_elements(v_new_items) el
              where coalesce(el->>'item_status', 'pending') not in ('voided', 'done')
                and coalesce(el->>'kind', 'menu') <> 'buffet_base'
            ) then status
            else 'done'
          end
      where id = v_carrier_order_id;
    end if;
  end if;

  select *
  into v_source_split
  from public.bill_splits
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  select *
  into v_target_split
  from public.bill_splits
  where session_id = v_target_session.id
    and status in ('pending', 'confirmed', 'requested')
  order by created_at desc
  limit 1
  for update;

  if v_source_split.id is not null and v_target_split.id is not null then
    update public.bill_splits
    set order_ids = (
          select array_agg(distinct x)
          from unnest(coalesce(v_target_split.order_ids, '{}'::uuid[]) || coalesce(v_source_split.order_ids, '{}'::uuid[])) as x
        ),
        persons = coalesce(v_target_split.persons, '[]'::jsonb) || coalesce(v_source_split.persons, '[]'::jsonb),
        result = coalesce(v_target_split.result, '[]'::jsonb) || coalesce(v_source_split.result, '[]'::jsonb),
        total_amount = coalesce(v_target_split.total_amount, 0) + coalesce(v_source_split.total_amount, 0)
    where id = v_target_split.id;

    delete from public.bill_splits
    where id = v_source_split.id;
  elsif v_source_split.id is not null then
    update public.bill_splits
    set session_id = v_target_session.id,
        table_id = p_target_table_id,
        display_name = v_target_display
    where id = v_source_split.id;
  end if;

  update public.bill_splits
  set session_id = v_target_session.id,
      table_id = p_target_table_id,
      display_name = v_target_display
  where session_id = v_source_session.id
    and status in ('pending', 'confirmed', 'requested');

  -- Source sushi rounds: discard basket in same TX (do not merge into target).
  update public.table_order_rounds
  set status = 'closed',
      updated_at = now()
  where session_id = v_source_session.id
    and status in ('collecting', 'pending_confirm', 'cooldown', 'finalize_failed');

  update public.table_sessions
  set status = 'closed',
      closed_at = now(),
      closed_reason = 'merged',
      merge_into_session_id = v_target_session.id,
      closed_by_user_id = v_operator_id
  where id = v_source_session.id;

  return v_target_session.id;
end;
$_$;
