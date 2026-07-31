import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
let printAgentVersion = '';
try {
  printAgentVersion = fs.readFileSync(path.join(configDir, '../print-agent/VERSION'), 'utf8').trim();
} catch {
  /* optional — runtime read fallback in print-agent-download.ts */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone only for Docker image builds (`DOCKER_BUILD=1`). Local `next start` stays normal.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
  transpilePackages: ['@mesa/shared', '@mesa/ui'],
  ...(printAgentVersion
    ? { env: { NEXT_PUBLIC_PRINT_AGENT_VERSION: printAgentVersion } }
    : {}),
  // Externalize @supabase/* on the server (avoids broken vendor-chunks paths with `@` in filenames).
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
    ...(process.env.DOCKER_BUILD === '1'
      ? { outputFileTracingRoot: path.join(configDir, '../..') }
      : {}),
  },
  async redirects() {
    return [
      {
        source: '/dashboard/print-assistant',
        destination: '/dashboard/settings/print-assistant',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // On-prem / local Supabase Storage (HTTP gateway).
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'http',
        hostname: 'host.docker.internal',
      },
    ],
  },
};

export default nextConfig;
