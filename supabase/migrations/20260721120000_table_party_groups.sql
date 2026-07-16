-- Waiter-board "同行组": runtime marker that guests at these tables are together.
-- Orthogonal to restaurant_table_groups (floor layout) and merge_table_sessions (single bill).

CREATE TABLE IF NOT EXISTS public.table_party_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_party_groups_name_len CHECK (
    char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 32
  )
);

CREATE INDEX idx_table_party_groups_restaurant_sort
  ON public.table_party_groups (restaurant_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.table_party_group_members (
  party_id uuid NOT NULL REFERENCES public.table_party_groups(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  PRIMARY KEY (party_id, table_id)
);

CREATE UNIQUE INDEX table_party_group_members_restaurant_table_unique
  ON public.table_party_group_members (restaurant_id, table_id);

CREATE INDEX idx_table_party_group_members_party
  ON public.table_party_group_members (party_id);

CREATE OR REPLACE FUNCTION public.enforce_table_party_member_same_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_party_restaurant uuid;
BEGIN
  SELECT g.restaurant_id
  INTO v_party_restaurant
  FROM public.table_party_groups g
  WHERE g.id = NEW.party_id;

  IF v_party_restaurant IS NULL
    OR v_party_restaurant <> NEW.restaurant_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = NEW.table_id
        AND rt.restaurant_id = NEW.restaurant_id
        AND rt.deleted_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'invalid_table_party_member';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_table_party_member_on_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.table_party_group_members
    WHERE table_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER table_party_group_members_same_restaurant
  BEFORE INSERT OR UPDATE OF party_id, table_id, restaurant_id
  ON public.table_party_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_table_party_member_same_restaurant();

CREATE TRIGGER restaurant_tables_soft_delete_purge_party_member
  AFTER UPDATE OF deleted_at
  ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_table_party_member_on_soft_delete();

ALTER TABLE public.table_party_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_party_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY table_party_groups_owner_all ON public.table_party_groups
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY table_party_groups_staff_select ON public.table_party_groups
  FOR SELECT TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]
    )
  );

CREATE POLICY table_party_group_members_owner_all ON public.table_party_group_members
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY table_party_group_members_staff_select ON public.table_party_group_members
  FOR SELECT TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['kitchen'::text, 'waiter'::text, 'cashier'::text]
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_party_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_party_group_members TO authenticated;
GRANT ALL ON public.table_party_groups TO service_role;
GRANT ALL ON public.table_party_group_members TO service_role;
