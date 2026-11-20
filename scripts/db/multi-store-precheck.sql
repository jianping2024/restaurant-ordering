-- Multi-store step 1 — violation precheck (docs/technical/multi-store-access-plan.zh.md §5.3 step 1).
-- Read-only. Run BEFORE applying 20261120120000_staff_identities_multi_store_step1.sql
-- (cloud: SQL editor / psql; on-prem: upgrade script). Zero rows = safe to migrate.
-- Any row must be cleaned up by hand first; the migration itself re-runs the same
-- checks and aborts (no half-migrated state) if a violation is still present.

-- 1) One auth user is owner_id of two or more restaurants.
SELECT 'owner_of_multiple_restaurants' AS violation,
       r.owner_id AS user_id,
       string_agg(r.slug, ', ' ORDER BY r.slug) AS detail
FROM public.restaurants r
WHERE r.owner_id IS NOT NULL
GROUP BY r.owner_id
HAVING count(*) > 1

UNION ALL

-- 2) A backend admin account (restaurants.owner_id) also has a staff membership row.
SELECT 'owner_has_staff_membership' AS violation,
       r.owner_id AS user_id,
       r.slug || ' owner; staff in ' || string_agg(s.slug, ', ' ORDER BY s.slug) AS detail
FROM public.restaurants r
JOIN public.restaurant_staff_accounts a ON a.user_id = r.owner_id
JOIN public.restaurants s ON s.id = a.restaurant_id
WHERE r.owner_id IS NOT NULL
GROUP BY r.owner_id, r.slug

UNION ALL

-- 3) A print_agent account has more than one membership row (any role).
SELECT 'print_agent_multiple_memberships' AS violation,
       a.user_id,
       string_agg(s.slug || ':' || a.role, ', ' ORDER BY s.slug) AS detail
FROM public.restaurant_staff_accounts a
JOIN public.restaurants s ON s.id = a.restaurant_id
WHERE a.user_id IN (
  SELECT user_id FROM public.restaurant_staff_accounts WHERE role = 'print_agent'
)
GROUP BY a.user_id
HAVING count(*) > 1;
