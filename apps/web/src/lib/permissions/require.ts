import 'server-only';

import { NextResponse } from 'next/server';
import { can, type Capabilities } from '@/lib/permissions/can';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import type { PermissionKey } from '@/lib/permissions/registry';
import type { Principal } from '@/lib/permissions/types';

export type PermissionOk = {
  principal: Principal;
  capabilities: Capabilities;
};

export function assertCapability(capabilities: Capabilities, key: PermissionKey): boolean {
  return can(capabilities, key);
}

/**
 * Dashboard / cookie-session API gate.
 * 401 if unauthenticated; 403 if authenticated without the permission.
 */
export async function requirePermission(
  key: PermissionKey,
): Promise<PermissionOk | NextResponse> {
  const loaded = await loadPrincipalWithCapabilities();
  if (!loaded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!can(loaded.capabilities, key)) {
    return NextResponse.json({ error: 'forbidden', permission: key }, { status: 403 });
  }
  return loaded;
}

export async function requireAnyPermission(
  keys: readonly PermissionKey[],
): Promise<PermissionOk | NextResponse> {
  const loaded = await loadPrincipalWithCapabilities();
  if (!loaded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!keys.some((key) => can(loaded.capabilities, key))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return loaded;
}
