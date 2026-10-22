import type { MetadataRoute } from 'next'
import { getSeoSiteUrl } from '@/lib/seo/config'

export default function robots(): MetadataRoute.Robots {
  const sitemap = `${getSeoSiteUrl()}/sitemap.xml`
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/post/', '/groups/', '/reels/'],
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/signin',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/verify-otp',
          '/create-password',
          '/confirm-signup',
          '/account-activated',
          '/auth/',
          '/feed',
          '/friends',
          '/saved',
          '/profile',
          '/settings',
          '/messages',
          '/chat',
          '/chat/',
          '/notifications',
          '/call/',
          '/stories/',
          '/my-orders',
          '/marketplace/selling',
          '/marketplace/buying',
          '/marketplace/disputes',
          '/groups/create',
          '/groups/*/edit',
          '/reels/foryou',
          '/reels/explore',
          '/reels/following',
          '/reels/my-videos',
          '/reels/create',
          '/user/',
        ],
      },
    ],
    sitemap,
  }
}
