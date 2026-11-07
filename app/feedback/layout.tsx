import { getPageMetadata } from '@/lib/seo'

export const metadata = getPageMetadata({
  title: 'Feedback',
  description:
    'Share feedback with CribsTalk to help improve the platform and community experience.',
  path: '/feedback',
  type: 'website',
})

export default function FeedbackLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
