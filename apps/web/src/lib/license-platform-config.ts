import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

/** Sole on-disk + env reader for platform license check-in config (on-prem web, Node only). */
export type PlatformLicenseConfig = {
  platformUrl: string;
  checkinCredential: string;
  leaseSecret: string;
};

/**
 * Mode B authority: MESA_LICENSE_CONFIG_PATH → host-mounted license-state/platform.json
 * (written by /setup claim: checkinCredential + leaseSecret from Ops; platformUrl from env).
 * Without CONFIG_PATH (local npm run): cwd `.mesa-license.local.json`, then env trio fallback.
 * Pack must not ship lease/checkin secrets — only MESA_PLATFORM_LICENSE_URL.
 */
const CONFIG_BASENAME = '.mesa-license.local.json';

function configFilePath(): string {
  const override = process.env.MESA_LICENSE_CONFIG_PATH?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), CONFIG_BASENAME);
}

function fromEnv(): PlatformLicenseConfig | null {
  const platformUrl = process.env.MESA_PLATFORM_LICENSE_URL?.trim().replace(/\/$/, '') || '';
  const checkinCredential = process.env.MESA_LICENSE_CHECKIN_CREDENTIAL?.trim() || '';
  const leaseSecret = process.env.MESA_LICENSE_LEASE_SECRET?.trim() || '';
  if (!platformUrl || !checkinCredential || !leaseSecret) return null;
  return { platformUrl, checkinCredential, leaseSecret };
}

function fromFile(): PlatformLicenseConfig | null {
  try {
    const raw = fs.readFileSync(configFilePath(), 'utf8');
    const json = JSON.parse(raw) as Partial<PlatformLicenseConfig>;
    const platformUrl = typeof json.platformUrl === 'string' ? json.platformUrl.trim().replace(/\/$/, '') : '';
    const checkinCredential =
      typeof json.checkinCredential === 'string' ? json.checkinCredential.trim() : '';
    const leaseSecret = typeof json.leaseSecret === 'string' ? json.leaseSecret.trim() : '';
    if (!platformUrl || !checkinCredential || !leaseSecret) return null;
    return { platformUrl, checkinCredential, leaseSecret };
  } catch {
    return null;
  }
}

/** File wins over env so apply-claim persist is authoritative after setup. */
export function loadPlatformLicenseConfig(): PlatformLicenseConfig | null {
  return fromFile() || fromEnv();
}

/**
 * Persist claim/check-in trio. Mode B: writes MESA_LICENSE_CONFIG_PATH (host volume).
 * Fail closed at runtime if this file is missing and env trio is incomplete.
 */
export function persistPlatformLicenseConfig(config: PlatformLicenseConfig): void {
  const payload: PlatformLicenseConfig = {
    platformUrl: config.platformUrl.trim().replace(/\/$/, ''),
    checkinCredential: config.checkinCredential.trim(),
    leaseSecret: config.leaseSecret.trim(),
  };
  if (!payload.platformUrl || !payload.checkinCredential || !payload.leaseSecret) {
    throw new Error('incomplete_platform_license_config');
  }
  const filePath = configFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}
