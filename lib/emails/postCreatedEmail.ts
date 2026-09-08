import {
  emailButtonHtml,
  emailHeadlineHtml,
  emailHintHtml,
  emailLeadHtml,
  emailSignOffHtml,
  emailStatusCardHtml,
  supportEmailPlain,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'
import { getEmailCopy, t } from './content'

export type PostCreatedEmailVariant = 'author' | 'friend'

export function getPostCreatedEmailHtml(params: {
  variant: PostCreatedEmailVariant
  authorName: string
  postPreview: string
  postId: string
}): string {
  const { variant, authorName, postPreview, postId } = params
  const copy = getEmailCopy(`postCreated.${variant}`)
  const vars = { authorName }
  const postUrl = `${getAppBaseUrl()}/post/${postId}`
  const preview = escapeHtml(postPreview)

  if (variant === 'author') {
    return `
      ${emailHeadlineHtml(t(copy.headline, vars, true))}
      ${emailLeadHtml(t(copy.lead, vars, true))}
      ${emailStatusCardHtml({
        title: t(copy.statusTitle, vars, true),
        subtitle: t(copy.statusSubtitle, vars, true),
        footer: t(copy.statusFooter, vars, true),
        variant: 'success',
      })}
      ${emailButtonHtml(postUrl, t(copy.buttonLabel))}
      ${emailHintHtml(t(copy.hint))}
      ${emailSignOffHtml(t(copy.signOff))}
    `
  }

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailStatusCardHtml({
      title: t(copy.fromEyebrow, vars, true),
      subtitle: preview,
      variant: 'info',
    })}
    ${emailButtonHtml(postUrl, t(copy.buttonLabel))}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getPostCreatedEmailText(params: {
  variant: PostCreatedEmailVariant
  authorName: string
  postPreview: string
  postId: string
}): string {
  const { variant, authorName, postPreview, postId } = params
  const copy = getEmailCopy(`postCreated.${variant}`)
  const support = supportEmailPlain()
  return t(copy.text, {
    authorName,
    postPreview,
    postUrl: `${getAppBaseUrl()}/post/${postId}`,
    supportLine: support ? `\nHelp: ${support}\n` : '',
  })
}
