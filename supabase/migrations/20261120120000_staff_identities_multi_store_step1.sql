-- Multi-store access — step 1 (docs/technical/multi-store-access-plan.zh.md §5.1–5.3).
-- * staff_identities: account-level staff fields (login_name, must_change_password, favorites).
-- * restaurant_staff_accounts: user_id no longer globally unique → UNIQUE (restaurant_id, user_id).
-- * DB triggers: backend admin (owner_id) ≠ staff; print_agent has exactly one membership.
-- * restaurants.owner_id unique when not null (one admin account per store).
-- Old restaurant_staff_accounts.login_name stays (dropped in step 2).
-- Detailed violation listing: scripts/db/multi-store-precheck.sql (run first).

-- ── Guard: abort the whole migration (no half state) when legacy data violates the rules.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE owner_id IS NOT NULL
    GROUP BY owner_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multi_store_precheck: owner_of_multiple_restaurants — run scripts/db/multi-store-precheck.sql';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.restaurant_staff_accounts a ON a.user_id = r.owner_id
  ) THEN
    RAISE EXCEPTION 'multi_store_precheck: owner_has_staff_membership — run scripts/db/multi-store-precheck.sql';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurant_staff_accounts a
    WHERE a.user_id IN (
      SELECT user_id FROM public.restaurant_staff_accounts WHERE role = 'print_agent'
    )
    GROUP BY a.user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multi_store_precheck: print_agent_multiple_memberships — run scripts/db/multi-store-precheck.sql';
  END IF;
END
$$;

-- ── staff_identities (one row per staff account incl. print_agent; admin accounts have none)
CREATE TABLE public.staff_identities (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  login_name text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  favorite_restaurant_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_identities_login_name_key UNIQUE (login_name)
);

COMMENT ON TABLE public.staff_identities IS
  'Account-level staff identity (login name, forced password change, store favorites). Server/admin client only — no anon/authenticated access.';

CREATE TRIGGER staff_identities_set_updated_at
  BEFORE UPDATE ON public.staff_identities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.staff_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_identities FROM anon, authenticated;
GRANT ALL ON TABLE public.staff_identities TO service_role;

-- Backfill: login_name from the membership row (one per user today), must_change_password
-- from the auth metadata flag (same truthiness as parseStaffUserMetadata: JSON true only).
INSERT INTO public.staff_identities (user_id, login_name, must_change_password, created_at)
SELECT DISTINCT ON (a.user_id)
  a.user_id,
  a.login_name,
  COALESCE(u.raw_user_meta_data -> 'must_change_password' = 'true'::jsonb, false),
  a.created_at
FROM public.restaurant_staff_accounts a
JOIN auth.users u ON u.id = a.user_id
ORDER BY a.user_id, a.created_at;

-- ── Membership uniqueness: per (restaurant, user) instead of per user.
ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_user_id_key;
ALTER TABLE public.restaurant_staff_accounts
  ADD CONSTRAINT restaurant_staff_accounts_restaurant_id_user_id_key UNIQUE (restaurant_id, user_id);
-- restaurant_staff_accounts_user_id_idx (non-unique) keeps by-user lookups indexed.

-- ── One backend admin account per store.
CREATE UNIQUE INDEX restaurants_owner_id_unique
  ON public.restaurants (owner_id)
  WHERE owner_id IS NOT NULL;

-- ── Trigger: staff membership rules (plan §3 补充约束 / §5.2).
-- SECURITY DEFINER: checks must see all rows even when the writer is an RLS-scoped
-- authenticated client (e.g. browser onboarding insert into restaurants).
-- Advisory lock on the user id serializes membership/owner writes for one account,
-- so concurrent inserts cannot both pass the EXISTS checks.
CREATE OR REPLACE FUNCTION public.enforce_staff_membership_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('staff_membership:' || NEW.user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = NEW.user_id) THEN
    RAISE EXCEPTION 'staff_user_is_restaurant_owner'
      USING ERRCODE = 'check_violation',
            DETAIL = 'A backend admin account (restaurants.owner_id) cannot hold staff memberships.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role <> 'print_agent' AND NEW.role = 'print_agent' THEN
    RAISE EXCEPTION 'staff_role_cannot_become_print_agent'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurant_staff_accounts a
    WHERE a.user_id = NEW.user_id
      AND a.id <> NEW.id
      AND (NEW.role = 'print_agent' OR a.role = 'print_agent')
  ) THEN
    RAISE EXCEPTION 'print_agent_single_membership'
      USING ERRCODE = 'check_violation',
            DETAIL = 'A print_agent account has exactly one membership row.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_staff_accounts_enforce_membership_rules
  BEFORE INSERT OR UPDATE OF user_id, role ON public.restaurant_staff_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_membership_rules();

-- ── Trigger: owner_id may not be a staff account (covers onboarding + license-materialize).
CREATE OR REPLACE FUNCTION public.enforce_restaurant_owner_not_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('staff_membership:' || NEW.owner_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.restaurant_staff_accounts a WHERE a.user_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'owner_user_has_staff_membership'
      USING ERRCODE = 'check_violation',
            DETAIL = 'A staff account cannot become a backend admin (restaurants.owner_id).';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_enforce_owner_not_staff
  BEFORE INSERT OR UPDATE OF owner_id ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_owner_not_staff();

REVOKE ALL ON FUNCTION public.enforce_staff_membership_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_restaurant_owner_not_staff() FROM PUBLIC, anon, authenticated;
