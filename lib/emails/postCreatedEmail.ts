import { SWIPPED, emailHeadlineHtml, emailLeadHtml, supportEmailPlain } from './swippedTheme'
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

  const supportBlock =
    supportPlain &&
    `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${SWIPPED.textSecondary};">
      Something look off? Reach us at <a href="mailto:${escapeHtml(supportPlain)}" style="color:${SWIPPED.link};">${escapeHtml(supportPlain)}</a>.
    </p>`

  if (variant === 'author') {
    return `
      ${emailHeadlineHtml('Your post is live')}
      ${emailLeadHtml('It’s on your profile and in your followers’ feeds. Here’s a quick preview.')}

      <div style="background-color:${SWIPPED.blueBoxBg};padding:20px;border-radius:10px;margin:0 0 24px;border-left:4px solid ${SWIPPED.blueBorder};">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${SWIPPED.textSecondary};">Preview</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:${SWIPPED.text};">${safePreview}</p>
      </div>

      <p style="text-align:center;margin:0 0 8px;">
        <a href="${postUrl}" style="${SWIPPED.ctaInline}">View on ConnectAfrik</a>
      </p>
      <p style="text-align:center;margin:0;font-size:14px;color:${SWIPPED.textSecondary};">
        Share the link or keep the conversation going in comments.
      </p>

      ${supportBlock || ''}

      <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
        Keep posting,<br />
        <span style="color:${SWIPPED.text};font-weight:600;">The ConnectAfrik team</span>
      </p>
    `
  }

  return `
    ${emailHeadlineHtml(`${safeAuthor} shared something new`)}
    ${emailLeadHtml('Open the post to read the full update and join the conversation.')}

    <div style="background-color:${SWIPPED.blueBoxBg};padding:20px;border-radius:10px;margin:0 0 24px;border-left:4px solid ${SWIPPED.blueBorder};">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${SWIPPED.textSecondary};">From ${safeAuthor}</p>
      <p style="margin:0;font-size:15px;line-height:1.5;color:${SWIPPED.text};">${safePreview}</p>
    </div>

    <p style="text-align:center;margin:0;">
      <a href="${postUrl}" style="${SWIPPED.ctaInline}">View post</a>
    </p>

    ${supportBlock || ''}

    <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
      See you in the feed,<br />
      <span style="color:${SWIPPED.text};font-weight:600;">The ConnectAfrik team</span>
    </p>
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
