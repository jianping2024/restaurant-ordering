alter table public.table_sessions
  add column if not exists opened_by_user_id uuid references auth.users (id) on delete set null;

comment on column public.table_sessions.opened_by_user_id is
  'Supabase auth user who opened the session (waiter buffet / waiter order). Null for legacy sessions or guest-only paths.';
