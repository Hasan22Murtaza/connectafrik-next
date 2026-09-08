import { EMAIL_THEME, emailButtonHtml, emailHeadlineHtml, emailHelpHtml, emailLeadHtml, emailSignOffHtml } from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'
import { getEmailCopy, t } from './content'

export type PlatformAnnouncementDetails = {
  recipientName: string
  title: string
  body: string
  ctaUrl?: string | null
  ctaLabel?: string | null
}

export function getPlatformAnnouncementEmailHtml(details: PlatformAnnouncementDetails): string {
  const copy = getEmailCopy('announcement')
  const href = details.ctaUrl?.trim() || `${getAppBaseUrl()}/feed`
  const label = details.ctaLabel?.trim() || t(copy.defaultCtaLabel)
  const paragraphs = details.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(
      (part) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_THEME.text};">${escapeHtml(part).replace(/\n/g, '<br />')}</p>`
    )
    .join('')

  return `
    ${emailHeadlineHtml(escapeHtml(details.title))}
    ${emailLeadHtml(t(copy.lead, { recipientName: details.recipientName }, true))}
    ${paragraphs}
    ${emailButtonHtml(href, escapeHtml(label))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getPlatformAnnouncementEmailText(details: PlatformAnnouncementDetails): string {
  const copy = getEmailCopy('announcement')
  return t(copy.text, {
    title: details.title,
    recipientName: details.recipientName,
    body: details.body,
    ctaLabel: details.ctaLabel?.trim() || t(copy.defaultCtaLabel),
    ctaUrl: details.ctaUrl?.trim() || `${getAppBaseUrl()}/feed`,
  })
}
