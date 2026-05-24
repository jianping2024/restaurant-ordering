-- Latest printer routing from print agent (for checkout receipt printer picker).

alter table public.print_agent_devices
  add column if not exists routing_snapshot jsonb;

comment on column public.print_agent_devices.routing_snapshot is
  'Receipt printer options synced from agent configure/setup: { receipt_printers: [{ id, label, role }], updated_at }';
