-- Dish association: menu_items stores note-preset *group* ids (not preset ids).
-- Wipe all restaurant note dictionaries and reseed the new 9-group defaults.

-- 1) Clear dish links, then rename column to group ids.
UPDATE public.menu_items
SET note_preset_keys = '{}'::text[];

DROP INDEX IF EXISTS public.idx_menu_items_note_preset_keys;

ALTER TABLE public.menu_items
  RENAME COLUMN note_preset_keys TO note_preset_group_ids;

COMMENT ON COLUMN public.menu_items.note_preset_group_ids IS
  'Enabled note-preset group ids (menu_note_preset_groups.id); guest sees all active presets in these groups.';

CREATE INDEX idx_menu_items_note_preset_group_ids
  ON public.menu_items USING gin (note_preset_group_ids);

COMMENT ON TABLE public.menu_note_presets IS
  'Per-restaurant note presets. menu_items.note_preset_group_ids references group ids; presets belong via group_id.';

-- 2) Wipe dictionaries (presets first: group_id RESTRICT).
DELETE FROM public.menu_note_presets;
DELETE FROM public.menu_note_preset_groups;

-- 3) Replace seed: 9 groups (no allergy / no ingredient-remove).
CREATE OR REPLACE FUNCTION public.seed_default_menu_note_presets(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g_spice uuid;
  g_salt uuid;
  g_oil uuid;
  g_sugar uuid;
  g_temp uuid;
  g_doneness uuid;
  g_sauce uuid;
  g_pack uuid;
  g_utensils uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.menu_note_preset_groups WHERE restaurant_id = p_restaurant_id LIMIT 1
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Spice level', 'Picante', '辣度', 0)
  RETURNING id INTO g_spice;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Salt', 'Sal', '盐', 1)
  RETURNING id INTO g_salt;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Oil', 'Oleo', '油', 2)
  RETURNING id INTO g_oil;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Sugar', 'Acucar', '糖', 3)
  RETURNING id INTO g_sugar;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Hot / ice', 'Quente / gelo', '冰热', 4)
  RETURNING id INTO g_temp;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Doneness', 'Ponto da carne', '火候熟度', 5)
  RETURNING id INTO g_doneness;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Sauce on side', 'Molho a parte', '酱汁分开', 6)
  RETURNING id INTO g_sauce;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Pack separately', 'Embalar separado', '分开打包', 7)
  RETURNING id INTO g_pack;

  INSERT INTO public.menu_note_preset_groups (restaurant_id, name_en, name_pt, name_zh, sort_order)
  VALUES (p_restaurant_id, 'Need utensils', 'Com talheres', '需要餐具', 8)
  RETURNING id INTO g_utensils;

  INSERT INTO public.menu_note_presets (restaurant_id, group_id, name_en, name_pt, name_zh, sort_order) VALUES
    (p_restaurant_id, g_spice, 'Not spicy', 'Sem picante', '不要辣', 0),
    (p_restaurant_id, g_spice, 'Mild', 'Pouco picante', '微辣', 1),
    (p_restaurant_id, g_spice, 'Medium spicy', 'Picante medio', '中辣', 2),
    (p_restaurant_id, g_spice, 'Extra spicy', 'Muito picante', '特辣', 3),
    (p_restaurant_id, g_salt, 'Less salt', 'Pouco sal', '少盐', 0),
    (p_restaurant_id, g_oil, 'Less oil', 'Pouco oleo', '少油', 0),
    (p_restaurant_id, g_sugar, 'No sugar', 'Sem acucar', '无糖', 0),
    (p_restaurant_id, g_sugar, '30% sugar', '30% acucar', '三分糖', 1),
    (p_restaurant_id, g_sugar, '50% sugar', '50% acucar', '五分糖', 2),
    (p_restaurant_id, g_sugar, '70% sugar', '70% acucar', '七分糖', 3),
    (p_restaurant_id, g_sugar, 'Full sugar', 'Acucar normal', '全糖', 4),
    (p_restaurant_id, g_temp, 'Hot', 'Quente', '热', 0),
    (p_restaurant_id, g_temp, 'Warm', 'Morno', '温', 1),
    (p_restaurant_id, g_temp, 'Room temp', 'Temperatura ambiente', '常温', 2),
    (p_restaurant_id, g_temp, 'No ice', 'Sem gelo', '去冰', 3),
    (p_restaurant_id, g_temp, 'Less ice', 'Pouco gelo', '少冰', 4),
    (p_restaurant_id, g_temp, 'Normal ice', 'Gelo normal', '正常冰', 5),
    (p_restaurant_id, g_temp, 'Extra ice', 'Muito gelo', '多冰', 6),
    (p_restaurant_id, g_doneness, 'Rare', 'Mal passado', '三分熟', 0),
    (p_restaurant_id, g_doneness, 'Medium', 'Ao ponto', '五分熟', 1),
    (p_restaurant_id, g_doneness, 'Medium well', 'Bem ao ponto', '七分熟', 2),
    (p_restaurant_id, g_doneness, 'Well done', 'Bem passado', '全熟', 3),
    (p_restaurant_id, g_sauce, 'Sauce on side', 'Molho a parte', '酱汁分开', 0),
    (p_restaurant_id, g_pack, 'Pack separately', 'Embalar separado', '分开打包', 0),
    (p_restaurant_id, g_utensils, 'Need utensils', 'Com talheres', '需要餐具', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_menu_note_presets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_menu_note_presets(uuid) TO service_role;

SELECT public.seed_default_menu_note_presets(r.id)
FROM public.restaurants r;
