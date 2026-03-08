/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Turbopack config (Next.js 16 default)
  turbopack: {},
  // Necessario per @solana/web3.js - evita errori di bundling dei moduli Node.js
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side: ignora i moduli Node.js nativi usati da Solana
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }
    return config
  },
}

export default nextConfig
