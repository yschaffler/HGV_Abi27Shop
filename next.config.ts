import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Für schlanke Docker-Images: nur der tatsächlich benötigte Node-Server wird gebündelt.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Build bricht bei Typfehlern ab. Kein "ignoreBuildErrors".
  // Lint laeuft seit Next 16 ueber die ESLint-CLI ("npm run lint"), nicht mehr ueber den Build.
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // Server Actions akzeptieren nur Requests von der eigenen Origin.
    serverActions: { bodySizeLimit: '3mb' },
  },
};

export default nextConfig;
