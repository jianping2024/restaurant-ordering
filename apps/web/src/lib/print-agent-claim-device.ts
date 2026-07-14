/** How claim resolves a physical device row for the target restaurant. */
export type ClaimDeviceOutcome = 'created' | 're_paired' | 'transferred';

export type ExistingClaimDevice = {
  id: string;
  restaurant_id: string;
};

export type ClaimDeviceRowInput = {
  deviceId: string;
  restaurantId: string;
  pairingId: string;
  label: string | null;
  validUntil: string;
  lastSeen: string;
};

/** Classify claim intent before pairing code is consumed. */
export function classifyClaimDevice(
  existing: ExistingClaimDevice | null | undefined,
  targetRestaurantId: string,
): ClaimDeviceOutcome {
  if (!existing) return 'created';
  if (existing.restaurant_id === targetRestaurantId) return 're_paired';
  return 'transferred';
}

/** Row payload for print_agent_devices upsert on successful claim. */
export function buildClaimDeviceRow(
  input: ClaimDeviceRowInput,
  outcome: ClaimDeviceOutcome,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: input.deviceId,
    restaurant_id: input.restaurantId,
    pairing_id: input.pairingId,
    label: input.label,
    valid_until: input.validUntil,
    revoked_at: null,
    last_seen: input.lastSeen,
  };

  if (outcome === 'transferred') {
    row.routing_snapshot = null;
    row.mapped_station_count = null;
    row.last_print_at = null;
    row.last_print_status = null;
    row.schedule_open = null;
  }

  return row;
}
