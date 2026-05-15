-- Invalidate staff session cookies when kitchen/waiter PIN changes (version in JWT).

alter table public.restaurants
  add column if not exists kitchen_password_version integer not null default 1,
  add column if not exists waiter_password_version integer not null default 1;

comment on column public.restaurants.kitchen_password_version is 'Bumped when kitchen PIN changes; must match staff session JWT pwd_ver for role kitchen';
comment on column public.restaurants.waiter_password_version is 'Bumped when waiter PIN changes; must match staff session JWT pwd_ver for role waiter';
