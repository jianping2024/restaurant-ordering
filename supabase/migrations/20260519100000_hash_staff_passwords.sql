-- Hash existing plaintext kitchen/waiter PINs with bcrypt.
-- On Supabase, pgcrypto lives in the extensions schema (not on search_path).

update public.restaurants
set kitchen_password = extensions.crypt(kitchen_password, extensions.gen_salt('bf'))
where kitchen_password is not null
  and kitchen_password !~ '^\$2[aby]\$\d{2}\$';

update public.restaurants
set waiter_password = extensions.crypt(waiter_password, extensions.gen_salt('bf'))
where waiter_password is not null
  and waiter_password !~ '^\$2[aby]\$\d{2}\$';

comment on column public.restaurants.kitchen_password is 'bcrypt hash of 4-digit kitchen PIN';
comment on column public.restaurants.waiter_password is 'bcrypt hash of 4-digit waiter PIN';
