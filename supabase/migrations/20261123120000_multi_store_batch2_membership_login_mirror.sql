-- Multi-store access — batch 2 (docs/technical/multi-store-access-plan.zh.md §3, §5.4, §7).
-- Opens multi-store memberships while staying rollback-compatible with batch 1 (expand → contract):
-- * Drop the global UNIQUE on restaurant_staff_accounts.login_name — one account may now have
--   several membership rows, all carrying the same login name. Global uniqueness stays on
--   staff_identities.login_name.
-- * Membership login_name stays NOT NULL and always mirrors staff_identities.login_name
--   (batch-1 code still reads a valid value). One-way sync: account → its memberships.
--   A new membership copies the account's value; an UPDATE that disagrees is refused.
--   Only a membership whose account has no identity yet (legacy create path) creates it.
-- * One-off: store "disable" used to Auth-ban the account; store enable no longer unbans.
--   Clear banned_until for every live staff account (has a staff_identities row; retired
--   accounts have none). Access is now gated by login preflight + each request reading the
--   membership (disabled_at). This also unbans accounts disabled via ops — their membership
--   disabled_at still blocks them. Platform admin accounts are left untouched.
-- 收尾阶段删除: membership login_name column + these sync triggers.

DROP INDEX IF EXISTS public.restaurant_staff_accounts_login_name_key;
ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_login_name_key;

-- ── Membership side: mirror the account's login name (never write it back).
DROP TRIGGER IF EXISTS restaurant_staff_accounts_sync_staff_identity
  ON public.restaurant_staff_accounts;
DROP FUNCTION IF EXISTS public.sync_staff_identity_from_membership();

CREATE OR REPLACE FUNCTION public.mirror_membership_login_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  account_login text;
BEGIN
  SELECT s.login_name INTO account_login
    FROM public.staff_identities s
   WHERE s.user_id = NEW.user_id;

  IF account_login IS NULL THEN
    -- Legacy create path (membership written first): create the account identity.
    -- staff_identities_login_name_key keeps login names globally unique (23505 = taken).
    INSERT INTO public.staff_identities (user_id, login_name, must_change_password)
    SELECT
      NEW.user_id,
      NEW.login_name,
      COALESCE(u.raw_user_meta_data -> 'must_change_password' = 'true'::jsonb, false)
    FROM auth.users u
    WHERE u.id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.login_name IS DISTINCT FROM account_login THEN
    RAISE EXCEPTION 'membership login_name must equal staff_identities.login_name'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.login_name := account_login;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_staff_accounts_mirror_login_name
  BEFORE INSERT OR UPDATE OF login_name, user_id ON public.restaurant_staff_accounts
  FOR EACH ROW EXECUTE FUNCTION public.mirror_membership_login_name();

-- ── Account side: a login name change fans out to every membership of the account.
CREATE OR REPLACE FUNCTION public.sync_membership_login_name_from_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.restaurant_staff_accounts
     SET login_name = NEW.login_name
   WHERE user_id = NEW.user_id
     AND login_name IS DISTINCT FROM NEW.login_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_identities_sync_membership_login_name ON public.staff_identities;
CREATE TRIGGER staff_identities_sync_membership_login_name
  AFTER UPDATE OF login_name ON public.staff_identities
  FOR EACH ROW EXECUTE FUNCTION public.sync_membership_login_name_from_identity();

REVOKE ALL ON FUNCTION public.mirror_membership_login_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_membership_login_name_from_identity() FROM PUBLIC, anon, authenticated;

-- Backfill: memberships already equal the identity today (step-1 backfill + release-0 sync);
-- align any drift so the mirror invariant holds from here on.
UPDATE public.restaurant_staff_accounts m
   SET login_name = s.login_name
  FROM public.staff_identities s
 WHERE s.user_id = m.user_id
   AND m.login_name IS DISTINCT FROM s.login_name;

-- One-off: lift store-disable Auth bans from live staff accounts (see header).
UPDATE auth.users u
   SET banned_until = NULL
 WHERE u.banned_until IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.staff_identities s WHERE s.user_id = u.id)
   AND NOT EXISTS (SELECT 1 FROM public.platform_admin_accounts p WHERE p.user_id = u.id);
