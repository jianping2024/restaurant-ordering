-- Retire on-prem → platform 经营日报 upload (Ops toggle + check-in sync).
-- Local analytics seal / analytics_daily_menu_item_stats stay for in-store value analytics.

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS daily_business_report_enabled;
