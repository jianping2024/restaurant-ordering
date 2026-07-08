-- One-time ops support tokens for read-only print-agent troubleshooting (no agentjwt exposure).

CREATE TABLE public.print_agent_support_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.print_agent_devices (id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_print_agent_support_tokens_device_created
  ON public.print_agent_support_tokens (device_id, created_at DESC);
ALTER TABLE public.print_agent_support_tokens ENABLE ROW LEVEL SECURITY;
