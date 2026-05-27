-- Allow owners to revoke unused pairing codes; pending slots exclude consumed and revoked rows.

alter table public.print_agent_pairings
  add column if not exists revoked_at timestamptz;

comment on column public.print_agent_pairings.revoked_at is
  'Set when the restaurant owner voids an unused code before expiry; frees a pending slot.';

drop index if exists public.idx_print_agent_pairings_claim_lookup;

create index if not exists idx_print_agent_pairings_claim_lookup
  on public.print_agent_pairings (code)
  where consumed_at is null and revoked_at is null;

create index if not exists idx_print_agent_pairings_restaurant_pending
  on public.print_agent_pairings (restaurant_id, expires_at desc)
  where consumed_at is null and revoked_at is null;
