import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  generateJsonLd,
  getGroupPostMetadata,
  getGroupPostSeoData,
  getGroupPostSeoInput,
  getNoIndexMetadata,
  isIndexableGroupPost,
  seoPaths,
  truncatePlainText,
} from '@/lib/seo'

export const revalidate = 300

type PageProps = {
  params: Promise<{ id: string; postId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, postId } = await params
  const post = await getGroupPostSeoData(id, postId)
  if (!post || !isIndexableGroupPost(post)) return getNoIndexMetadata('Group post')
  return getGroupPostMetadata(post)
}

export default async function GroupPostPage({ params }: PageProps) {
  const { id, postId } = await params
  const post = await getGroupPostSeoData(id, postId)
  if (!post || !isIndexableGroupPost(post)) notFound()

  const seo = getGroupPostSeoInput(post)
  const media = (post.media_urls ?? []).filter(Boolean)
  const authorName = post.author?.full_name || post.author?.username || 'ConnectAfrik member'

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={generateJsonLd(seo)} />
      {seo.breadcrumbs && <Breadcrumbs items={seo.breadcrumbs} />}
      <p className="text-sm text-content-secondary">
        In{' '}
        <Link href={seoPaths.group(post.group_id)} className="font-medium text-primary-600 hover:underline">
          {post.group.name}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-content">
        {truncatePlainText(post.title, 140) || 'Group post'}
      </h1>
      <p className="mt-2 text-sm text-content-secondary">
        By {authorName}
        {post.created_at ? ` · ${new Date(post.created_at).toLocaleDateString()}` : ''}
      </p>
      <div className="mt-6 whitespace-pre-wrap text-content">{post.content}</div>
      {media.length > 0 && (
        <div className="mt-6 space-y-4">
          {media.map((url) => {
            const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
            if (isVideo) {
              return (
                <video key={url} src={url} controls className="w-full rounded-lg bg-black" />
              )
            }
            return (
              // User-uploaded media can live on any configured CDN host; match the rest of the app.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt={post.title || 'Group post media'} className="w-full rounded-lg" />
            )
          })}
        </div>
      )}
      <p className="mt-8">
        <Link
          href={`${seoPaths.group(post.group_id)}?post=${post.id}`}
          className="btn-primary inline-flex"
        >
          View in group
        </Link>
      </p>
    </article>
  )
}
