-- Staff accounts: login_name is the business credential; email lived only as a redundant copy of auth.users.email.

ALTER TABLE public.restaurant_staff_accounts
  DROP CONSTRAINT IF EXISTS restaurant_staff_accounts_email_key;
ALTER TABLE public.restaurant_staff_accounts
  DROP COLUMN IF EXISTS email;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_staff_accounts_login_name_key
  ON public.restaurant_staff_accounts (login_name);
