import { SWIPPED, supportEmailHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

export type PostCreatedEmailVariant = 'author' | 'friend'

/** Inner HTML — typography and CTA match Swipped `resetPasswordEmail.js`. */
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
  const support = supportEmailHtml()

  const body =
    variant === 'author'
      ? `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Your post is now live on ConnectAfrik.
    </p>`
      : `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      <strong>${safeAuthor}</strong> shared a new post you might want to see.
    </p>`

  const greeting =
    variant === 'author'
      ? `<p style="font-size:20px;color:${SWIPPED.text};">Hi <b>${safeAuthor},</b></p>`
      : `<p style="font-size:20px;color:${SWIPPED.text};">Hi,</p>`

  const supportLine = support
    ? `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Need help? Contact us at ${support}.
    </p>`
    : ''

  return `
    ${greeting}
    ${body}
    <div style="background-color:${SWIPPED.blueBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.blueBorder};">
      <p style="margin:0;font-size:14px;color:${SWIPPED.text};"><strong>Post preview</strong></p>
      <p style="margin:10px 0 0;font-size:14px;color:${SWIPPED.text};">${safePreview}</p>
    </div>
    <p style="text-align:center;padding-top:16px;">
      <a href="${postUrl}" style="${SWIPPED.ctaInline}">View post</a>
    </p>
    ${supportLine}
    <p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Thanks, <br> The ConnectAfrik Team
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

  const textLead =
    variant === 'author'
      ? `Hi ${authorName},\n\nYour post is now live on ConnectAfrik.\n\n`
      : `Hi,\n\n${authorName} shared a new post you might want to see.\n\n`

  const supportLine = support ? `\nNeed help? Contact us at ${support}.\n` : ''

  return `${textLead}${postPreview}\n\nView: ${postUrl}${supportLine}\n\nThanks,\nThe ConnectAfrik Team\n`
}
