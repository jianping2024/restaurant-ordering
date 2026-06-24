/** Public URL of @mesa/ops (platform console), for redirects from deprecated tenant admin flows. */
export function getOpsAppUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_OPS_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3001';
  return null;
}
