-- Restaurant-managed note-preset dictionary (groups + items).
-- Dish association: menu_items.note_preset_keys stores preset UUIDs as text[].
-- Upgrade: clear all prior hardcoded-key associations (no remap / compat).

CREATE TABLE IF NOT EXISTS public.menu_note_preset_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_pt text NOT NULL,
  name_zh text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_note_preset_groups_name_en_nonempty CHECK (length(btrim(name_en)) > 0),
  CONSTRAINT menu_note_preset_groups_name_pt_nonempty CHECK (length(btrim(name_pt)) > 0)
);

CREATE TABLE IF NOT EXISTS public.menu_note_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.menu_note_preset_groups(id) ON DELETE RESTRICT,
  name_en text NOT NULL,
  name_pt text NOT NULL,
  name_zh text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_note_presets_name_en_nonempty CHECK (length(btrim(name_en)) > 0),
  CONSTRAINT menu_note_presets_name_pt_nonempty CHECK (length(btrim(name_pt)) > 0)
);

CREATE INDEX idx_menu_note_preset_groups_restaurant_sort
  ON public.menu_note_preset_groups (restaurant_id, sort_order, created_at);

CREATE INDEX idx_menu_note_presets_restaurant_group_sort
  ON public.menu_note_presets (restaurant_id, group_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.enforce_menu_note_preset_same_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.menu_note_preset_groups g
    WHERE g.id = NEW.group_id
      AND g.restaurant_id = NEW.restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_note_preset_group';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_note_presets_same_restaurant ON public.menu_note_presets;
CREATE TRIGGER menu_note_presets_same_restaurant
  BEFORE INSERT OR UPDATE OF restaurant_id, group_id
  ON public.menu_note_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_menu_note_preset_same_restaurant();

COMMENT ON TABLE public.menu_note_preset_groups IS
  'Per-restaurant note preset groups (CRUD). Empty group may be deleted; group with presets may not.';
COMMENT ON TABLE public.menu_note_presets IS
  'Per-restaurant note presets. menu_items.note_preset_keys references these ids.';

ALTER TABLE public.menu_note_preset_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_note_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_note_preset_groups_select ON public.menu_note_preset_groups
  FOR SELECT TO public
  USING (true);

CREATE POLICY menu_note_presets_select ON public.menu_note_presets
  FOR SELECT TO public
  USING (true);

CREATE POLICY menu_note_preset_groups_owner_all ON public.menu_note_preset_groups
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )))
  WITH CHECK ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )));

CREATE POLICY menu_note_presets_owner_all ON public.menu_note_presets
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )))
  WITH CHECK ((restaurant_id IN (
    SELECT restaurants.id FROM public.restaurants
    WHERE restaurants.owner_id = (select auth.uid())
  )));

CREATE POLICY menu_note_preset_groups_frontdesk_all ON public.menu_note_preset_groups
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

CREATE POLICY menu_note_presets_frontdesk_all ON public.menu_note_presets
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

GRANT SELECT ON public.menu_note_preset_groups TO anon, authenticated;
GRANT SELECT ON public.menu_note_presets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_note_preset_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_note_presets TO authenticated;
GRANT ALL ON public.menu_note_preset_groups TO service_role;
GRANT ALL ON public.menu_note_presets TO service_role;

-- Wipe legacy hardcoded preset keys on dishes (no remap).
UPDATE public.menu_items
SET note_preset_keys = '{}'::text[]
WHERE coalesce(cardinality(note_preset_keys), 0) > 0;

/**
 * Sole default dictionary seed for a restaurant.
 * Idempotent: no-op when the restaurant already has any note-preset group.
 */
CREATE OR REPLACE FUNCTION public.seed_default_menu_note_presets(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g_taste uuid;
  g_doneness uuid;
  g_allergy uuid;
  g_ingredients uuid;
  g_service uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.menu_note_preset_groups WHERE restaurant_id = p_restaurant_id LIMIT 1
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Taste preference', 'Preferência de sabor', '口味偏好', 0)
  RETURNING id INTO g_taste;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Doneness', 'Ponto da carne', '火候熟度', 1)
  RETURNING id INTO g_doneness;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Allergy / diet', 'Alergia / dieta', '过敏忌口', 2)
  RETURNING id INTO g_allergy;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Ingredients', 'Ingredientes', '配料去留', 3)
  RETURNING id INTO g_ingredients;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Service', 'Serviço', '出餐方式', 4)
  RETURNING id INTO g_service;

  INSERT INTO public.menu_note_presets (restaurant_id, group_id, name_en, name_pt, name_zh, sort_order) VALUES
    (p_restaurant_id, g_taste, 'Less salt', 'Pouco sal', '少盐', 0),
    (p_restaurant_id, g_taste, 'Less oil', 'Pouco óleo', '少油', 1),
    (p_restaurant_id, g_taste, 'Not spicy', 'Sem picante', '不要辣', 2),
    (p_restaurant_id, g_taste, 'Medium spicy', 'Picante médio', '中辣', 3),
    (p_restaurant_id, g_taste, 'Extra spicy', 'Picante extra', '特辣', 4),
    (p_restaurant_id, g_taste, 'Less sweet', 'Menos doce', '少糖', 5),
    (p_restaurant_id, g_doneness, 'Rare', 'Mal passado', '三分熟', 0),
    (p_restaurant_id, g_doneness, 'Medium', 'Ao ponto', '五分熟', 1),
    (p_restaurant_id, g_doneness, 'Medium well', 'Bem ao ponto', '七分熟', 2),
    (p_restaurant_id, g_doneness, 'Well done', 'Bem passado', '全熟', 3),
    (p_restaurant_id, g_allergy, 'Gluten free', 'Sem glúten', '无麸质', 0),
    (p_restaurant_id, g_allergy, 'No dairy', 'Sem lácteos', '无乳制品', 1),
    (p_restaurant_id, g_allergy, 'No peanut', 'Sem amendoim', '无花生', 2),
    (p_restaurant_id, g_allergy, 'No shellfish', 'Sem marisco', '无贝类', 3),
    (p_restaurant_id, g_allergy, 'No egg', 'Sem ovo', '无蛋', 4),
    (p_restaurant_id, g_ingredients, 'No onion', 'Sem cebola', '不要洋葱', 0),
    (p_restaurant_id, g_ingredients, 'No garlic', 'Sem alho', '不要蒜', 1),
    (p_restaurant_id, g_ingredients, 'No coriander', 'Sem coentros', '不要香菜', 2),
    (p_restaurant_id, g_ingredients, 'No scallion', 'Sem cebolinha', '不要葱', 3),
    (p_restaurant_id, g_ingredients, 'No mushroom', 'Sem cogumelos', '不要蘑菇', 4),
    (p_restaurant_id, g_service, 'Sauce on side', 'Molho à parte', '酱汁分开', 0),
    (p_restaurant_id, g_service, 'Pack separately', 'Embalar separado', '分开打包', 1),
    (p_restaurant_id, g_service, 'Need utensils', 'Com talheres', '需要餐具', 2);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_menu_note_presets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_menu_note_presets(uuid) TO service_role;

SELECT public.seed_default_menu_note_presets(r.id)
FROM public.restaurants r;
