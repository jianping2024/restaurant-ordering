/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mesa/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
  },
};

export default nextConfig;
