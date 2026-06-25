-- Table groups for owner dashboard + waiter board layout.

CREATE TABLE IF NOT EXISTS public.restaurant_table_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  remarks text,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_table_groups_name_len CHECK (
    char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 32
  )
);

CREATE UNIQUE INDEX restaurant_table_groups_restaurant_name_unique
  ON public.restaurant_table_groups (restaurant_id, name);

CREATE INDEX idx_restaurant_table_groups_restaurant_sort
  ON public.restaurant_table_groups (restaurant_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.restaurant_table_group_members (
  group_id uuid NOT NULL REFERENCES public.restaurant_table_groups(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, table_id)
);

CREATE UNIQUE INDEX restaurant_table_group_members_restaurant_table_unique
  ON public.restaurant_table_group_members (restaurant_id, table_id);

CREATE INDEX idx_restaurant_table_group_members_group
  ON public.restaurant_table_group_members (group_id);

CREATE OR REPLACE FUNCTION public.enforce_table_group_member_same_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_restaurant uuid;
BEGIN
  SELECT g.restaurant_id
  INTO v_group_restaurant
  FROM public.restaurant_table_groups g
  WHERE g.id = NEW.group_id;

  IF v_group_restaurant IS NULL
    OR v_group_restaurant <> NEW.restaurant_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = NEW.table_id
        AND rt.restaurant_id = NEW.restaurant_id
        AND rt.deleted_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'invalid_table_group_member';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_table_group_member_on_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.restaurant_table_group_members
    WHERE table_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_table_group_members_same_restaurant
  BEFORE INSERT OR UPDATE OF group_id, table_id, restaurant_id
  ON public.restaurant_table_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_table_group_member_same_restaurant();

CREATE TRIGGER restaurant_tables_soft_delete_purge_group_member
  AFTER UPDATE OF deleted_at
  ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_table_group_member_on_soft_delete();

CREATE OR REPLACE FUNCTION public.replace_table_group_members(
  p_group_id uuid,
  p_table_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT g.restaurant_id
  INTO v_restaurant_id
  FROM public.restaurant_table_groups g
  WHERE g.id = p_group_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = v_restaurant_id
      AND r.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_table_ids IS NOT NULL AND cardinality(p_table_ids) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = ANY (p_table_ids)
        AND (rt.restaurant_id <> v_restaurant_id OR rt.deleted_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'invalid_table_ids';
    END IF;

    DELETE FROM public.restaurant_table_group_members
    WHERE restaurant_id = v_restaurant_id
      AND table_id = ANY (p_table_ids);
  END IF;

  DELETE FROM public.restaurant_table_group_members
  WHERE group_id = p_group_id;

  IF p_table_ids IS NOT NULL AND cardinality(p_table_ids) > 0 THEN
    INSERT INTO public.restaurant_table_group_members (group_id, table_id, restaurant_id)
    SELECT p_group_id, tid, v_restaurant_id
    FROM unnest(p_table_ids) AS tid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_table_group_members(uuid, uuid[]) TO authenticated;

ALTER TABLE public.restaurant_table_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_table_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY restaurant_table_groups_owner_all ON public.restaurant_table_groups
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY restaurant_table_groups_staff_select ON public.restaurant_table_groups
  FOR SELECT TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]
    )
  );

CREATE POLICY restaurant_table_group_members_owner_all ON public.restaurant_table_group_members
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY restaurant_table_group_members_staff_select ON public.restaurant_table_group_members
  FOR SELECT TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_table_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_table_group_members TO authenticated;
GRANT ALL ON public.restaurant_table_groups TO service_role;
GRANT ALL ON public.restaurant_table_group_members TO service_role;
