-- Base subscription list price (EUR). Separate aggregate from Pro feature add-ons.

CREATE TABLE IF NOT EXISTS public.subscription_base_product (
  id text PRIMARY KEY DEFAULT 'default'
    CHECK (id = 'default'),
  price_month_eur numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (price_month_eur >= 0),
  price_year_eur numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (price_year_eur >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscription_base_product IS
  'Platform base subscription list price (EUR month/year). Store quote = this + granted Pro feature prices.';

INSERT INTO public.subscription_base_product (id, price_month_eur, price_year_eur)
VALUES ('default', 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.subscription_base_product ENABLE ROW LEVEL SECURITY;
