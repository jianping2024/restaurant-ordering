-- Repair remote environments where migration history includes
-- 20260527120000 but print_agent_devices is still missing heartbeat columns.

alter table public.print_agent_devices
  add column if not exists agent_version text,
  add column if not exists mapped_station_count integer,
  add column if not exists last_print_at timestamptz,
  add column if not exists last_print_status text,
  add column if not exists schedule_open boolean;

comment on column public.print_agent_devices.agent_version is 'MesaPrintAgent build version from heartbeat.';
comment on column public.print_agent_devices.mapped_station_count is 'Non-empty station_printers mappings at last heartbeat.';
comment on column public.print_agent_devices.last_print_at is 'Timestamp of last print attempt reported by agent.';
comment on column public.print_agent_devices.last_print_status is 'done | failed from last print attempt.';
comment on column public.print_agent_devices.schedule_open is 'Whether agent was inside business hours at last heartbeat.';

notify pgrst, 'reload schema';
