/** @type {import('next').NextConfig} */
const nextConfig = {
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
