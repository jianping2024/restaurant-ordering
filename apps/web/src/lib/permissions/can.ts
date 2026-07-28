import type { PermissionKey } from '@/lib/permissions/registry';

/** Owner principal: all permissions. Staff: finite set from restaurant_roles.permissions. */
export type Capabilities = '*' | ReadonlySet<PermissionKey>;

/** JSON-safe form for RSC → client props (Set is not serializable). */
export type CapabilitiesPayload = '*' | PermissionKey[];

export function can(capabilities: Capabilities, key: PermissionKey): boolean {
  if (capabilities === '*') return true;
  return capabilities.has(key);
}

export function canAny(capabilities: Capabilities, keys: readonly PermissionKey[]): boolean {
  return keys.some((key) => can(capabilities, key));
}

export function capabilitiesFromKeys(keys: readonly string[]): Set<PermissionKey> {
  return new Set(keys as PermissionKey[]);
}

export function toCapabilitiesPayload(capabilities: Capabilities): CapabilitiesPayload {
  if (capabilities === '*') return '*';
  return Array.from(capabilities);
}

export function fromCapabilitiesPayload(payload: CapabilitiesPayload): Capabilities {
  if (payload === '*') return '*';
  return new Set(payload);
}
