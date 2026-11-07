import { getPageMetadata } from '@/lib/seo'

export const metadata = getPageMetadata({
  title: 'Our Story',
  description:
    'Learn how CribsTalk brings people together to share stories, celebrate culture, and build communities.',
  path: '/our-story',
  type: 'website',
})

export default function OurStoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
