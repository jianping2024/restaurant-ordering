-- Audit: who manually closed a table session (waiter / owner force-close).
alter table public.table_sessions
  add column if not exists closed_by_user_id uuid references auth.users (id);

comment on column public.table_sessions.closed_by_user_id is
  'Supabase auth user who force-closed the session (waiter/owner). Null for auto_nightly, merge, or paid checkout close.';
