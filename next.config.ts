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

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.b-cdn.net' },
      ...(bunnyCdnHost
        ? [{ protocol: 'https' as const, hostname: bunnyCdnHost }]
        : []),
    ],
  },

  async redirects() {
    return [
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
      { source: '/guidelines', destination: '/community-standards', permanent: true },
      { source: '/support', destination: '/contact', permanent: false },
      { source: '/settings/privacy', destination: '/profile?tab=privacy', permanent: false },
      { source: '/settings/content', destination: '/profile?tab=privacy', permanent: false },
      { source: '/settings/blocking', destination: '/profile?tab=privacy', permanent: false },
    ]
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
