-- Cloud schedule + poll for print agents (dashboard-editable; agent fetches once at startup).

alter table public.restaurants
  add column if not exists print_agent_config jsonb not null default '{}'::jsonb;

comment on column public.restaurants.print_agent_config is
  'Print agent schedule/poll JSON: { schedule, poll }. Printers stay on the local agent config.';
