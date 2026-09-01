-- M3.2: Ops store fiscal policy (profile + terminal limits). Agent consumes via API only.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS fiscal_profile text
    CHECK (fiscal_profile IS NULL OR fiscal_profile IN ('restaurant', 'retail')),
  ADD COLUMN IF NOT EXISTS max_fiscal_terminals integer NOT NULL DEFAULT 1
    CHECK (max_fiscal_terminals >= 1);

COMMENT ON COLUMN restaurants.fiscal_profile IS 'Ops-only: restaurant|retail; required before fiscal signing activate';
COMMENT ON COLUMN restaurants.max_fiscal_terminals IS 'Ops-only: max LAN fiscal terminal slots';

CREATE TABLE IF NOT EXISTS fiscal_terminal_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_terminal_pairings_open_code_idx
  ON fiscal_terminal_pairings (restaurant_id, code)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS fiscal_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label text,
  active boolean NOT NULL DEFAULT true,
  ops_terminal_ref uuid NOT NULL DEFAULT gen_random_uuid(),
  pairing_id uuid REFERENCES fiscal_terminal_pairings(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS fiscal_terminals_restaurant_active_idx
  ON fiscal_terminals (restaurant_id)
  WHERE active = true AND revoked_at IS NULL;

ALTER TABLE fiscal_terminal_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_terminals ENABLE ROW LEVEL SECURITY;
