-- Curated recommended dishes (merchandising list). Not a real menu_categories row
-- and not a boolean on menu_items.

CREATE TABLE IF NOT EXISTS public.menu_recommended_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX menu_recommended_items_restaurant_item_unique
  ON public.menu_recommended_items (restaurant_id, menu_item_id);

CREATE UNIQUE INDEX menu_recommended_items_restaurant_sort_unique
  ON public.menu_recommended_items (restaurant_id, sort_order);

CREATE INDEX idx_menu_recommended_items_restaurant_sort
  ON public.menu_recommended_items (restaurant_id, sort_order, created_at);

COMMENT ON TABLE public.menu_recommended_items IS
  'Ordered recommended dishes for the customer menu strip. Empty = hide the recommended section.';

CREATE OR REPLACE FUNCTION public.enforce_menu_recommended_item_same_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = NEW.menu_item_id
      AND mi.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_recommended_menu_item';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER menu_recommended_items_same_restaurant
  BEFORE INSERT OR UPDATE OF restaurant_id, menu_item_id
  ON public.menu_recommended_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_menu_recommended_item_same_restaurant();

ALTER TABLE public.menu_recommended_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_recommended_items_select ON public.menu_recommended_items
  FOR SELECT TO public
  USING (true);

CREATE POLICY menu_recommended_items_owner_all ON public.menu_recommended_items
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )))
  WITH CHECK ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )));

CREATE POLICY menu_recommended_items_frontdesk_all ON public.menu_recommended_items
  FOR ALL TO authenticated
  USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]))
  WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]));

GRANT SELECT ON public.menu_recommended_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_recommended_items TO authenticated;
GRANT ALL ON public.menu_recommended_items TO service_role;
