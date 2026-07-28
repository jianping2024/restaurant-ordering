/**
 * Floor-board UI capabilities — derived only from Capability RBAC.
 * Do not add role switches here; grant keys on restaurant_roles.permissions.
 */
export type {
  FloorBoardCapabilities,
} from '@/lib/permissions/resolve';

export {
  floorBoardCapabilitiesFromCaps as floorBoardCapabilities,
} from '@/lib/permissions/resolve';

export type { Capabilities } from '@/lib/permissions/can';
