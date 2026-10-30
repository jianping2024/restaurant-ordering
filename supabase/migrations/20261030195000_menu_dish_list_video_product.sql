-- Pro add-on: point-of-sale list card motion (depends on menu_dish_video grant).
-- No backfill of restaurant_pro_feature_grants — existing dish-video stores stay without list.

ALTER TABLE public.pro_feature_products
  DROP CONSTRAINT IF EXISTS pro_feature_products_feature_key_check;

ALTER TABLE public.pro_feature_products
  ADD CONSTRAINT pro_feature_products_feature_key_check
  CHECK (
    feature_key = ANY (
      ARRAY[
        'value_analytics'::text,
        'abnormal_ops'::text,
        'operation_logs'::text,
        'menu_dish_video'::text,
        'menu_dish_list_video'::text
      ]
    )
  );

ALTER TABLE public.restaurant_pro_feature_grants
  DROP CONSTRAINT IF EXISTS restaurant_pro_feature_grants_feature_key_check;

ALTER TABLE public.restaurant_pro_feature_grants
  ADD CONSTRAINT restaurant_pro_feature_grants_feature_key_check
  CHECK (
    feature_key = ANY (
      ARRAY[
        'value_analytics'::text,
        'abnormal_ops'::text,
        'operation_logs'::text,
        'menu_dish_video'::text,
        'menu_dish_list_video'::text
      ]
    )
  );

INSERT INTO public.pro_feature_products (feature_key, price_month_eur, price_year_eur, active)
VALUES ('menu_dish_list_video', 0, 0, true)
ON CONFLICT (feature_key) DO NOTHING;
