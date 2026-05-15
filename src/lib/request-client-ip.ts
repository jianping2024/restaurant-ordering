export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
