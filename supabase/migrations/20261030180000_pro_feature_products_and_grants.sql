-- Pro commercial domain: platform price catalog + per-restaurant feature grants.
-- Replaces global premium_keys checklist as the entitlement source of truth.

CREATE TABLE IF NOT EXISTS public.pro_feature_products (
  feature_key text PRIMARY KEY
    CHECK (
      feature_key = ANY (
        ARRAY[
          'value_analytics'::text,
          'abnormal_ops'::text,
          'operation_logs'::text,
          'menu_dish_video'::text
        ]
      )
    ),
  price_month_eur numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (price_month_eur >= 0),
  price_year_eur numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (price_year_eur >= 0),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pro_feature_products IS
  'Platform Pro product catalog: monthly/yearly EUR list prices per premium feature key.';

INSERT INTO public.pro_feature_products (feature_key, price_month_eur, price_year_eur, active)
VALUES
  ('value_analytics', 0, 0, true),
  ('abnormal_ops', 0, 0, true),
  ('operation_logs', 0, 0, true),
  ('menu_dish_video', 0, 0, true)
ON CONFLICT (feature_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.restaurant_pro_feature_grants (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  feature_key text NOT NULL
    CHECK (
      feature_key = ANY (
        ARRAY[
          'value_analytics'::text,
          'abnormal_ops'::text,
          'operation_logs'::text,
          'menu_dish_video'::text
        ]
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, feature_key)
);

COMMENT ON TABLE public.restaurant_pro_feature_grants IS
  'Per-restaurant Pro feature entitlements. Usable only when restaurant Pro is effective.';

CREATE INDEX IF NOT EXISTS idx_restaurant_pro_feature_grants_feature
  ON public.restaurant_pro_feature_grants (feature_key);

ALTER TABLE public.pro_feature_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_pro_feature_grants ENABLE ROW LEVEL SECURITY;

-- Backfill: every plan=pro restaurant gets the legacy global premium_keys set
-- (or product defaults when settings row missing).
WITH catalog AS (
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN jsonb_typeof(premium_keys) = 'array' AND jsonb_array_length(premium_keys) > 0
          THEN (
            SELECT jsonb_agg(DISTINCT value)
            FROM jsonb_array_elements_text(premium_keys) AS t(value)
            WHERE value = ANY (
              ARRAY[
                'value_analytics',
                'abnormal_ops',
                'operation_logs',
                'menu_dish_video'
              ]
            )
          )
        ELSE NULL
      END
      FROM public.platform_pro_settings
      WHERE id = 'default'
    ),
    '["value_analytics","abnormal_ops","operation_logs","menu_dish_video"]'::jsonb
  ) AS keys
)
INSERT INTO public.restaurant_pro_feature_grants (restaurant_id, feature_key)
SELECT r.id, k.key
FROM public.restaurants r
CROSS JOIN catalog c
CROSS JOIN LATERAL jsonb_array_elements_text(c.keys) AS k(key)
WHERE r.plan = 'pro'
ON CONFLICT (restaurant_id, feature_key) DO NOTHING;

COMMENT ON TABLE public.platform_pro_settings IS
  'Legacy singleton (premium_keys / contact links). Entitlement+pricing moved to pro_feature_products + restaurant_pro_feature_grants; do not use for new gates.';
