-- Staff email format: `{login_name}@mesa.in` (no restaurant slug segment).
-- Rely on `email` unique; drop per-restaurant login_name uniqueness so the same logical login maps to one global mailbox.

alter table public.restaurant_staff_accounts
  drop constraint if exists restaurant_staff_accounts_restaurant_id_login_name_key;
