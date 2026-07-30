/** Env-only — safe for any bundle. Do not import fs here. */
export function isOnPremInstallHost(): boolean {
  const v = (process.env.MESA_ON_PREM || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
