import { EmailTemplate } from './EmailTemplate'
import { EMAIL_THEME, emailButtonHtml, emailHeadlineHtml, emailHintHtml, emailLeadHtml } from './emailTheme'
import { escapeHtml } from './utils'
import { getEmailCopy, t } from './content'

export function getSignupConfirmationEmailHtml(confirmationUrl: string): string {
  const copy = getEmailCopy('verifyEmail')
  const safeUrl = escapeHtml(confirmationUrl)

  const content = `
    ${emailHeadlineHtml(t(copy.headline))}
    ${emailLeadHtml(t(copy.lead))}
    ${emailButtonHtml(safeUrl, t(copy.buttonLabel))}
    ${emailHintHtml(t(copy.footerFallbackLink))}
    <p style="margin:0;font-family:${EMAIL_THEME.fontSans};font-size:12px;line-height:1.5;color:${EMAIL_THEME.textMuted};word-break:break-all;text-align:center;">
      <a href="${safeUrl}" style="color:${EMAIL_THEME.link};text-decoration:underline;">${safeUrl}</a>
    </p>`

  return EmailTemplate({
    content,
    subject: t(copy.subject),
    badge: t(copy.badge),
    preheader: t(copy.preheader),
  })
}

export function getSignupConfirmationEmailText(confirmationUrl: string): string {
  const copy = getEmailCopy('verifyEmail')
  return t(copy.text, { confirmationUrl })
}
