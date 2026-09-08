import { EMAIL_THEME, emailHeadlineHtml, emailLeadHtml } from './emailTheme'
import { EmailTemplate } from './EmailTemplate'
import { getEmailCopy, hasEmailCopy, t } from './content'

export function getOtpEmailHtml(code: string, purpose: string): string {
  const path = hasEmailCopy(`otp.${purpose}`) ? `otp.${purpose}` : 'otp.signup'
  const copy = getEmailCopy(path)

  const content = `
    ${emailHeadlineHtml(t(copy.headline))}
    ${emailLeadHtml(t(copy.codeHint))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td align="center" style="padding:20px 16px;border:1px solid ${EMAIL_THEME.border};border-radius:12px;background:${EMAIL_THEME.cardBg};">
          <span style="display:inline-block;letter-spacing:10px;font-size:32px;font-weight:700;color:${EMAIL_THEME.heading};font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;line-height:1.2;">${code}</span>
        </td>
      </tr>
    </table>
    <p style="font-family:${EMAIL_THEME.fontSans};font-size:13px;color:${EMAIL_THEME.textMuted};margin:0;text-align:left;line-height:1.5;">
      ${t(copy.ignoreHint)}
    </p>`

  return EmailTemplate({
    content,
    subject: t(copy.subject),
    badge: t(copy.badge),
    preheader: t(copy.preheader),
  })
}

export function getOtpEmailText(code: string, purpose: string): string {
  const path = hasEmailCopy(`otp.${purpose}`) ? `otp.${purpose}` : 'otp.signup'
  const copy = getEmailCopy(path)
  return t(copy.text, { headline: t(copy.headline), code })
}
