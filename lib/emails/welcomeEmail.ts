import {
  EMAIL_THEME,
  emailButtonHtml,
  emailHeadlineHtml,
  emailHelpHtml,
  emailLeadHtml,
  emailSecondaryLinkHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { getEmailCopy, t } from './content'

function featureRowHtml(title: string, description: string, last = false): string {
  const border = last ? '' : `border-bottom:1px solid ${EMAIL_THEME.border};`
  return `
    <tr>
      <td style="padding:16px 0;${border}">
        <p style="margin:0;font-family:${EMAIL_THEME.fontSans};font-size:15px;font-weight:700;color:${EMAIL_THEME.heading};">${title}</p>
        <p style="margin:6px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:14px;line-height:1.5;color:${EMAIL_THEME.text};">${description}</p>
      </td>
    </tr>`
}

export function getWelcomeEmailHtml(userName: string): string {
  const copy = getEmailCopy('welcome')
  const vars = { userName }
  const base = getAppBaseUrl()
  const features = copy.features || []

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;border:1px solid ${EMAIL_THEME.border};border-radius:12px;">
      <tr>
        <td style="padding:8px 20px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${features
        .map((feature, index) =>
          featureRowHtml(feature.title, feature.description, index === features.length - 1)
        )
        .join('')}
          </table>
        </td>
      </tr>
    </table>

    ${emailButtonHtml(`${base}/feed`, t(copy.buttonLabel))}
    ${emailSecondaryLinkHtml(`${base}/profile`, t(copy.secondaryLinkLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getWelcomeEmailText(userName: string): string {
  const copy = getEmailCopy('welcome')
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const helpLine = support
    ? `Questions? Reply to this email or contact us at ${support}.\n`
    : `Help: ${base}/support\n`

  return t(copy.text, {
    userName,
    feedUrl: `${base}/feed`,
    profileUrl: `${base}/profile`,
    helpLine,
  })
}
