import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailLeadHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

export type PostCreatedEmailVariant = 'author' | 'friend'

export function getPostCreatedEmailHtml(params: {
  variant: PostCreatedEmailVariant
  authorName: string
  postPreview: string
  postId: string
}): string {
  const { variant, authorName, postPreview, postId } = params
  const safeAuthor = escapeHtml(authorName)
  const safePreview = escapeHtml(postPreview)
  const base = getAppBaseUrl()
  const postUrl = `${base}/post/${postId}`
  const supportPlain = supportEmailPlain()

  const supportBlock = supportPlain
    ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${EMAIL_THEME.text};text-align:center;">
        Something look off? Reach us at <a href="mailto:${escapeHtml(supportPlain)}" style="color:${EMAIL_THEME.link};">${escapeHtml(supportPlain)}</a>.
      </p>`
    : ''

  const previewBody = `<p style="margin:0;font-size:15px;line-height:1.5;color:${EMAIL_THEME.heading};">${safePreview}</p>`

  if (variant === 'author') {
    return `
      ${emailHeadlineHtml('Your post is live')}
      ${emailLeadHtml('It’s on your profile and in your followers’ feeds. Here’s a quick preview.')}

      ${emailAccentBoxHtml({ variant: 'info', eyebrow: 'Preview', bodyHtml: previewBody })}

      ${emailButtonHtml(postUrl, 'View on ConnectAfrik')}
      <p style="text-align:center;margin:0;font-size:14px;color:${EMAIL_THEME.text};">
        Share the link or keep the conversation going in comments.
      </p>

      ${supportBlock}

      ${emailSignOffHtml('Keep posting,')}
    `
  }

  return `
    ${emailHeadlineHtml(`${safeAuthor} shared something new`)}
    ${emailLeadHtml('Open the post to read the full update and join the conversation.')}

    ${emailAccentBoxHtml({ variant: 'info', eyebrow: `From ${safeAuthor}`, bodyHtml: previewBody })}

    ${emailButtonHtml(postUrl, 'View post')}

    ${supportBlock}

    ${emailSignOffHtml('See you in the feed,')}
  `
}

export function getPostCreatedEmailText(params: {
  variant: PostCreatedEmailVariant
  authorName: string
  postPreview: string
  postId: string
}): string {
  const { variant, authorName, postPreview, postId } = params
  const base = getAppBaseUrl()
  const postUrl = `${base}/post/${postId}`
  const support = supportEmailPlain()
  const supportLine = support ? `\nHelp: ${support}\n` : ''

  if (variant === 'author') {
    return `Your post is live on ConnectAfrik

Hi ${authorName},

Your post is now visible on your profile and in feeds. Preview:

${postPreview}

View it here: ${postUrl}
${supportLine}
— The ConnectAfrik team
`
  }

  return `New post from ${authorName}

${authorName} shared an update you might want to see:

${postPreview}

Read it here: ${postUrl}
${supportLine}
— The ConnectAfrik team
`
}
