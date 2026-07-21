-- Last-known notifier mode from agent heartbeat (realtime | polling).
ALTER TABLE public.print_agent_devices
  ADD COLUMN IF NOT EXISTS notification_mode text;

ALTER TABLE public.print_agent_devices
  DROP CONSTRAINT IF EXISTS print_agent_devices_notification_mode_check;

ALTER TABLE public.print_agent_devices
  ADD CONSTRAINT print_agent_devices_notification_mode_check
  CHECK (notification_mode IS NULL OR notification_mode IN ('realtime', 'polling'));

COMMENT ON COLUMN public.print_agent_devices.notification_mode IS
  'Last heartbeat notifier mode: realtime (WebSocket) or polling (HTTP fallback).';
