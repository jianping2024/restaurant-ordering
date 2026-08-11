-- Pro tier: basic|pro plan rename, pro_valid_until, global premium catalog settings.

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;

UPDATE public.restaurants SET plan = 'basic' WHERE plan = 'free' OR plan IS NULL;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_plan_check CHECK (plan IN ('basic', 'pro'));

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pro_valid_until timestamptz;

COMMENT ON COLUMN public.restaurants.pro_valid_until IS
  'Pro membership expiry (UTC). Null with plan=pro means no pro expiry. Effective pro also requires license_valid_until when set.';

CREATE TABLE IF NOT EXISTS public.platform_pro_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  premium_keys jsonb NOT NULL DEFAULT '["value_analytics","abnormal_ops","operation_logs"]'::jsonb,
  wechat_url text,
  whatsapp_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_pro_settings IS
  'Singleton: which premium keys require Pro + upgrade contact links for tenant upsell page.';

INSERT INTO public.platform_pro_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_pro_settings ENABLE ROW LEVEL SECURITY;
