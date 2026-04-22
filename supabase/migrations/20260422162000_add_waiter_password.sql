alter table public.restaurants
add column if not exists waiter_password text not null default '5678';
