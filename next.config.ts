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

// Browser-only aliases — never apply these on the server (breaks Node crypto).
const browserNodePolyfillAliases = {
  crypto: { browser: 'crypto-browserify' },
  stream: { browser: 'stream-browserify' },
  assert: { browser: 'assert' },
  buffer: { browser: 'buffer' },
  process: { browser: 'process/browser' },
  fs: { browser: './lib/empty-module.js' },
  path: { browser: './lib/empty-module.js' },
  os: { browser: './lib/empty-module.js' },
}

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

  // libsignal is Node-oriented; polyfill Node built-ins for the client only.
  // Force qrcode's browser entry — Turbopack does not always honor package.json "browser".
  turbopack: {
    resolveAlias: {
      ...browserNodePolyfillAliases,
      qrcode: './node_modules/qrcode/lib/browser.js',
    },
  },

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert/'),
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser'),
        fs: false,
        path: false,
        os: false,
      }
      // Force browser QR entry — Node server/canvas build breaks client QR render.
      config.resolve.alias = {
        ...config.resolve.alias,
        qrcode: require.resolve('qrcode/lib/browser.js'),
      }
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      )
    }
    return config
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
