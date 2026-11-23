import type { Principal } from '@/lib/permissions/types';
import type { Capabilities } from '@/lib/permissions/can';

export type PrincipalWithCapabilities = {
  principal: Principal;
  capabilities: Capabilities;
};
