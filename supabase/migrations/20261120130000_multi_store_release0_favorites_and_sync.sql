-- Multi-store access — release 0 (docs/technical/multi-store-access-plan.zh.md §5.1, §5.4, §9).
-- Behavior unchanged. Ships before batch 1 so batch 1 can roll back to this release safely.
-- * restaurant_staff_accounts.favorited_at: store favorite is a property of the membership row.
-- * staff_identities.favorite_restaurant_ids (step 1) dropped — never read/written by code.
-- * Transitional sync triggers (expand → contract): programs that only write the old places
--   (membership login_name, auth user_metadata must_change_password) keep staff_identities
--   correct, so accounts created/renamed between migration and the new program still log in.
--   收尾阶段删除（§9 收尾：删同步 trigger + 店籍行 login_name 列）.

ALTER TABLE public.restaurant_staff_accounts
  ADD COLUMN favorited_at timestamptz NULL;

COMMENT ON COLUMN public.restaurant_staff_accounts.favorited_at IS
  'Store favorite for store picker/switcher (UX only); null = not favorited. Gone with the membership row.';

ALTER TABLE public.staff_identities
  DROP COLUMN favorite_restaurant_ids;

COMMENT ON TABLE public.staff_identities IS
  'Account-level staff identity (login name, forced password change). Server/admin client only — no anon/authenticated access.';

-- ── Sync 1: membership login_name insert/update → staff_identities.login_name.
-- New row: must_change_password seeded from auth metadata (JSON true only, same as step-1 backfill).
-- 收尾阶段删除.
CREATE OR REPLACE FUNCTION public.sync_staff_identity_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.staff_identities (user_id, login_name, must_change_password)
  SELECT
    NEW.user_id,
    NEW.login_name,
    COALESCE(u.raw_user_meta_data -> 'must_change_password' = 'true'::jsonb, false)
  FROM auth.users u
  WHERE u.id = NEW.user_id
  ON CONFLICT (user_id) DO UPDATE
    SET login_name = EXCLUDED.login_name
    WHERE public.staff_identities.login_name IS DISTINCT FROM EXCLUDED.login_name;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_staff_accounts_sync_staff_identity
  AFTER INSERT OR UPDATE OF login_name, user_id ON public.restaurant_staff_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_identity_from_membership();

-- ── Sync 2: auth user_metadata must_change_password change → staff_identities.
-- Only updates an existing row (staff accounts); backend admin accounts have none → no-op.
-- 收尾阶段删除.
CREATE OR REPLACE FUNCTION public.sync_staff_identity_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_flag boolean :=
    COALESCE(NEW.raw_user_meta_data -> 'must_change_password' = 'true'::jsonb, false);
BEGIN
  IF next_flag IS NOT DISTINCT FROM
     COALESCE(OLD.raw_user_meta_data -> 'must_change_password' = 'true'::jsonb, false) THEN
    RETURN NEW;
  END IF;

  UPDATE public.staff_identities
     SET must_change_password = next_flag
   WHERE user_id = NEW.id
     AND must_change_password IS DISTINCT FROM next_flag;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_users_sync_staff_identity_must_change_password
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_identity_must_change_password();

REVOKE ALL ON FUNCTION public.sync_staff_identity_from_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_staff_identity_must_change_password() FROM PUBLIC, anon, authenticated;
