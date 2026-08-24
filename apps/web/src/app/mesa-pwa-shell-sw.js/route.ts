import { getWebAppBuildInfo } from '@/lib/web-app-build';
import { buildPwaShellServiceWorkerScript } from '@/lib/pwa/shell-sw';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Sole HTTP entry for the PWA shell Service Worker script. */
export function GET() {
  const { version } = getWebAppBuildInfo();
  const body = buildPwaShellServiceWorkerScript(version);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
