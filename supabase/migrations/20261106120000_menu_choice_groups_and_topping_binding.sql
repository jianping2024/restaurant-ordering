-- 口味分组（点单必选选项，非展示用 flavor_codes）+ 菜品浇头绑定。
-- choice_bindings: [{ group_id, option_ids: uuid[] }]
-- topping_binding: { category_id, item_ids: uuid[] /* empty = 该类全部 */, required: boolean } | null

CREATE TABLE IF NOT EXISTS public.menu_choice_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_pt text NOT NULL,
  name_zh text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_choice_groups_name_en_nonempty CHECK (length(btrim(name_en)) > 0),
  CONSTRAINT menu_choice_groups_name_pt_nonempty CHECK (length(btrim(name_pt)) > 0)
);

CREATE TABLE IF NOT EXISTS public.menu_choice_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.menu_choice_groups(id) ON DELETE RESTRICT,
  name_en text NOT NULL,
  name_pt text NOT NULL,
  name_zh text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_choice_options_name_en_nonempty CHECK (length(btrim(name_en)) > 0),
  CONSTRAINT menu_choice_options_name_pt_nonempty CHECK (length(btrim(name_pt)) > 0)
);

CREATE INDEX idx_menu_choice_groups_restaurant_sort
  ON public.menu_choice_groups (restaurant_id, sort_order, created_at);

CREATE INDEX idx_menu_choice_options_restaurant_group_sort
  ON public.menu_choice_options (restaurant_id, group_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.enforce_menu_choice_option_same_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.menu_choice_groups g
    WHERE g.id = NEW.group_id
      AND g.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_choice_group';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_choice_options_same_restaurant ON public.menu_choice_options;
CREATE TRIGGER menu_choice_options_same_restaurant
  BEFORE INSERT OR UPDATE OF restaurant_id, group_id
  ON public.menu_choice_options
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_menu_choice_option_same_restaurant();

COMMENT ON TABLE public.menu_choice_groups IS
  'Per-restaurant order-time choice groups (口味分组). Guest must pick one option per dish-bound group.';
COMMENT ON TABLE public.menu_choice_options IS
  'Options inside a choice group. Referenced by menu_items.choice_bindings.';

ALTER TABLE public.menu_choice_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_choice_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_choice_groups_select ON public.menu_choice_groups
  FOR SELECT TO public
  USING (true);

CREATE POLICY menu_choice_options_select ON public.menu_choice_options
  FOR SELECT TO public
  USING (true);

CREATE POLICY menu_choice_groups_owner_all ON public.menu_choice_groups
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )))
  WITH CHECK ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )));

CREATE POLICY menu_choice_options_owner_all ON public.menu_choice_options
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )))
  WITH CHECK ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )));

CREATE POLICY menu_choice_groups_frontdesk_all ON public.menu_choice_groups
  FOR ALL TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  )
  WITH CHECK (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  );

CREATE POLICY menu_choice_options_frontdesk_all ON public.menu_choice_options
  FOR ALL TO authenticated
  USING (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  )
  WITH CHECK (
    public.is_active_restaurant_staff(
      restaurant_id,
      ARRAY['frontdesk'::text, 'owner'::text]
    )
  );

GRANT SELECT ON public.menu_choice_groups TO anon, authenticated;
GRANT SELECT ON public.menu_choice_options TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_choice_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_choice_options TO authenticated;
GRANT ALL ON public.menu_choice_groups TO service_role;
GRANT ALL ON public.menu_choice_options TO service_role;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS choice_bindings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS topping_binding jsonb NULL;

COMMENT ON COLUMN public.menu_items.choice_bindings IS
  'Order-time choice bindings: [{group_id, option_ids[]}]. Guest single-select required per bound group.';
COMMENT ON COLUMN public.menu_items.topping_binding IS
  'Optional topping link: {category_id, item_ids[] (empty=all in category), required}. Null = no topping step.';

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_choice_bindings_is_array;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_choice_bindings_is_array
  CHECK (jsonb_typeof(choice_bindings) = 'array');

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_topping_binding_object_or_null;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_topping_binding_object_or_null
  CHECK (topping_binding IS NULL OR jsonb_typeof(topping_binding) = 'object');
