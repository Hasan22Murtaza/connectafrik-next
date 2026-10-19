import type { NextConfig } from 'next'

const bunnyCdnHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_BUNNY_CDN_URL
      ? new URL(process.env.NEXT_PUBLIC_BUNNY_CDN_URL).hostname
      : null
  } catch {
    return null
  }
})()

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['@matrix-org/matrix-sdk-crypto-wasm'],
  webpack: (config) => {
    config.module.rules.push({
      test: /matrix_sdk_crypto_wasm_bg\.wasm$/,
      type: 'asset/resource',
    })
    return config
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.b-cdn.net' },
      ...(bunnyCdnHost
        ? [{ protocol: 'https' as const, hostname: bunnyCdnHost }]
        : []),
    ],
  },

  async rewrites() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/api/well-known/apple-app-site-association',
      },
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/well-known/assetlinks',
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ]
  },
}

export default nextConfig
