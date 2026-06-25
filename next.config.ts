import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,

  /**
   * Expose the deep-link association files at their required well-known paths.
   * The handlers live under /api/well-known/* (regular, non-dot routes) and are
   * surfaced here so iOS/Android fetch them from the canonical locations with no
   * redirects.
   */
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
