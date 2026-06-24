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
  transpilePackages: ['@mesa/shared'],
  ...(printAgentVersion
    ? { env: { NEXT_PUBLIC_PRINT_AGENT_VERSION: printAgentVersion } }
    : {}),
  // Externalize @supabase/* on the server (avoids broken vendor-chunks paths with `@` in filenames).
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
