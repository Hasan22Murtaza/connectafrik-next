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
      // Matrix E2EE WASM must be application/wasm for instantiateStreaming.
      {
        source: '/matrix_sdk_crypto_wasm_bg.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
