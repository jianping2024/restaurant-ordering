-- Dish motion video (Pro): generated in the staff browser when a dish photo is uploaded.
-- video_url      = 960×720 mp4 for the guest dish-detail hero (≤ 1MB)
-- rail_video_url = 480×360 mp4 for the guest recommended rail poster (≤ 1MB)
-- video_effect   = motion template the staff picked (needed to show / regenerate)
-- All three are set together or cleared together; any photo change clears them
-- unless a new video is uploaded in the same write.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS rail_video_url text,
  ADD COLUMN IF NOT EXISTS video_effect text;

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_video_effect_check;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_video_effect_check
  CHECK (video_effect IS NULL OR video_effect IN ('push', 'steam', 'gloss', 'pan', 'bubbles', 'frost'));

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_video_fields_together_check;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_video_fields_together_check
  CHECK (
    (video_url IS NULL) = (video_effect IS NULL)
    AND (video_url IS NULL) = (rail_video_url IS NULL)
    AND (video_url IS NULL OR image_url IS NOT NULL)
  );

COMMENT ON COLUMN public.menu_items.video_url IS
  'Guest detail motion video (mp4 ≤1MB, menu-images bucket); null = photo only. Shown only when Pro menu_dish_video + feature menu_dish_video_enabled.';
COMMENT ON COLUMN public.menu_items.rail_video_url IS
  'Guest recommended-rail motion video (480×360 mp4); set/cleared with video_url.';
COMMENT ON COLUMN public.menu_items.video_effect IS
  'Motion template: push|steam|gloss|pan|bubbles|frost; set/cleared with video_url.';

-- Platform Pro catalog: dish video is a Pro feature. Stored catalogs written before this
-- key existed would otherwise treat it as free (normalizePremiumKeys keeps stored arrays).
ALTER TABLE public.platform_pro_settings
  ALTER COLUMN premium_keys
  SET DEFAULT '["value_analytics","abnormal_ops","operation_logs","menu_dish_video"]'::jsonb;

UPDATE public.platform_pro_settings
SET premium_keys = premium_keys || '["menu_dish_video"]'::jsonb
WHERE jsonb_typeof(premium_keys) = 'array'
  AND NOT (premium_keys @> '["menu_dish_video"]'::jsonb);
