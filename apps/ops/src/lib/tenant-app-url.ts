/** Public URL of @mesa/web (tenant product), for menu links from ops. */
export function getTenantAppUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_TENANT_APP_URL?.trim() || process.env.TENANT_APP_URL?.trim();
  return (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
}
