import {
  EMAIL_THEME,
  emailButtonHtml,
  emailHeadlineHtml,
  emailLeadHtml,
  emailSecondaryLinkHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

function featureRowHtml(title: string, description: string, last = false): string {
  const border = last ? '' : `border-bottom:1px solid ${EMAIL_THEME.border};`
  return `
    <tr>
      <td style="padding:16px 0;${border}">
        <p style="margin:0;font-size:15px;font-weight:600;color:${EMAIL_THEME.heading};">${title}</p>
        <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${EMAIL_THEME.text};">${description}</p>
      </td>
    </tr>`
}

export function getWelcomeEmailHtml(userName: string): string {
  const base = getAppBaseUrl()
  const feedUrl = `${base}/feed`
  const profileUrl = `${base}/profile`
  const supportPlain = supportEmailPlain()
  const supportSafe = supportPlain ? escapeHtml(supportPlain) : ''
  const safeName = escapeHtml(userName)

  const helpLine = supportPlain
    ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${EMAIL_THEME.text};text-align:center;">
        Questions? Reply to this email or write us at <a href="mailto:${supportSafe}" style="color:${EMAIL_THEME.link};">${supportSafe}</a>.
      </p>`
    : `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${EMAIL_THEME.text};text-align:center;">
        Need help? Visit our <a href="${base}/support" style="color:${EMAIL_THEME.link};">help center</a>.
      </p>`

  return `
    ${emailHeadlineHtml(`Welcome, ${safeName}`)}
    ${emailLeadHtml(
      'Thanks for joining ConnectAfrik. Your profile is live — here are a few quick wins to explore the community.'
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      ${featureRowHtml('Finish your profile', 'Add a photo and a short bio so people recognize you.')}
      ${featureRowHtml('Open your feed', 'See posts from people and groups you care about.')}
      ${featureRowHtml(
        'Discover the marketplace',
        'Shop and sell products and services from African creators and businesses.'
      )}
      ${featureRowHtml('Join a group', 'Find communities around culture, business, and shared interests.', true)}
    </table>

    ${emailButtonHtml(feedUrl, 'Go to your feed')}
    ${emailSecondaryLinkHtml(profileUrl, 'Edit your profile')}

    ${helpLine}

    ${emailSignOffHtml('Glad you’re here.')}
  `
}

export function getWelcomeEmailText(userName: string): string {
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const helpLine = support
    ? `Questions? Reply to this email or contact us at ${support}.\n`
    : `Help: ${base}/support\n`

  return `Welcome to ConnectAfrik, ${userName}!

Thanks for signing up. Your account is ready. Here’s what to try first:

• Finish your profile — photo and bio help people find you.
• Open your feed — see posts from your network.
• Explore the marketplace — buy and sell with the community.
• Join a group — connect around shared interests.

Go to your feed: ${base}/feed
Edit profile: ${base}/profile

${helpLine}— The ConnectAfrik team
`
}
