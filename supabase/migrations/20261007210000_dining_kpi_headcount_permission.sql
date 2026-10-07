-- Grant dining-KPI headcount to roles that already see the floor board.

UPDATE public.restaurant_roles
SET permissions = permissions || '["dashboard.waiter_board.dining_headcount.view"]'::jsonb
WHERE permissions @> '["dashboard.waiter_board.view"]'::jsonb
  AND NOT (permissions @> '["dashboard.waiter_board.dining_headcount.view"]'::jsonb);
