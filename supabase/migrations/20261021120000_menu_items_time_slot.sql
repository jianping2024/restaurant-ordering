-- Menu dish time slot: null = served all day; otherwise only in that buffet_time_slots slot.
-- Same-restaurant guarantee via composite FK; deleting a slot puts its dishes back to all day.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.buffet_time_slots'::regclass
      and conname = 'buffet_time_slots_restaurant_id_id_key'
  ) then
    alter table public.buffet_time_slots
      add constraint buffet_time_slots_restaurant_id_id_key unique (restaurant_id, id);
  end if;
end $$;

alter table public.menu_items
  add column if not exists time_slot_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_time_slot_fkey'
  ) then
    alter table public.menu_items
      add constraint menu_items_time_slot_fkey
      foreign key (restaurant_id, time_slot_id)
      references public.buffet_time_slots (restaurant_id, id)
      on delete set null (time_slot_id);
  end if;
end $$;

create index if not exists idx_menu_items_time_slot
  on public.menu_items (time_slot_id)
  where time_slot_id is not null;

comment on column public.menu_items.time_slot_id is
  'Menu time slot (buffet_time_slots). Null = all day. Guest menu + append use the slot nearest to the table session opened_at (lib/menu-time-slot).';
