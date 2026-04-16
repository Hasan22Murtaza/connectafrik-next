import { SWIPPED, emailHeadlineHtml, emailLeadHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

export function getWelcomeEmailHtml(userName: string): string {
  const base = getAppBaseUrl()
  const feedUrl = `${base}/feed`
  const profileUrl = `${base}/profile`
  const supportPlain = supportEmailPlain()
  const supportSafe = supportPlain ? escapeHtml(supportPlain) : ''
  const safeName = escapeHtml(userName)

  const helpLine = supportPlain
    ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${SWIPPED.textSecondary};">
      Questions? Reply to this email or write us at <a href="mailto:${supportSafe}" style="color:${SWIPPED.link};">${supportSafe}</a>.
    </p>`
    : `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${SWIPPED.textSecondary};">
      Need help? Visit our <a href="${base}/support" style="color:${SWIPPED.link};">help center</a>.
    </p>`

  return `
    ${emailHeadlineHtml(`Welcome, ${safeName}`)}
    ${emailLeadHtml(
      'Thanks for joining ConnectAfrik. Your profile is live — here are a few quick wins to explore the community.'
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${SWIPPED.borderSubtle};">
          <p style="margin:0;font-size:15px;font-weight:600;color:${SWIPPED.text};">Finish your profile</p>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
            Add a photo and a short bio so people recognize you.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${SWIPPED.borderSubtle};">
          <p style="margin:0;font-size:15px;font-weight:600;color:${SWIPPED.text};">Open your feed</p>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
            See posts from people and groups you care about.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${SWIPPED.borderSubtle};">
          <p style="margin:0;font-size:15px;font-weight:600;color:${SWIPPED.text};">Discover the marketplace</p>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
            Shop and sell products and services from African creators and businesses.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 0;">
          <p style="margin:0;font-size:15px;font-weight:600;color:${SWIPPED.text};">Join a group</p>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
            Find communities around culture, business, and shared interests.
          </p>
        </td>
      </tr>
    </table>

    <p style="text-align:center;margin:8px 0 12px;">
      <a href="${feedUrl}" style="${SWIPPED.ctaInline}">Go to your feed</a>
    </p>
    <p style="text-align:center;margin:0;">
      <a href="${profileUrl}" style="font-size:14px;color:${SWIPPED.link};text-decoration:underline;">Edit your profile</a>
    </p>

    ${helpLine}

    <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
      Glad you’re here.<br />
      <span style="color:${SWIPPED.text};font-weight:600;">The ConnectAfrik team</span>
    </p>
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

${helpLine}
— The ConnectAfrik team
`
}
