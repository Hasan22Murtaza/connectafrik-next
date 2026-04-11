import { SWIPPED, supportEmailHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

/** Matches Swipped `welcomeEmail.js` / `getRegistrationWelcomeEmailTemplate` patterns. */
export function getWelcomeEmailHtml(userName: string): string {
  const base = getAppBaseUrl()
  const feedUrl = `${base}/feed`
  const support = supportEmailHtml()
  const safeName = escapeHtml(userName)

  const steps = `
      1. <strong>Complete your profile</strong> – Add a photo, bio, and share your story.<br />
      2. <strong>Find friends &amp; connect</strong> – Search by country, city, or interests.<br />
      3. <strong>Explore the marketplace</strong> – Buy and sell African products and services.<br />
      4. <strong>Join groups</strong> – Connect around culture, business, and more.
    `

  const helpLine = support
    ? `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Need help? Reply to this email or contact us at ${support}.
    </p>`
    : `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Need help? Visit our <a href="${base}/support" style="color:${SWIPPED.ctaBg};">support</a> page.
    </p>`

  return `
    <p style="font-size:20px;color:${SWIPPED.text};">Hi <b>${safeName},</b></p>

    <p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Welcome to <strong>ConnectAfrik</strong>! Your account is active and ready to use.
    </p>

    <p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Here is what you can do next:
    </p>

    <p style="font-size:14px;color:${SWIPPED.text};">
      ${steps}
    </p>

    <p style="text-align:center;padding-top:16px;">
      <a href="${feedUrl}" style="${SWIPPED.ctaInline}">
        Open ConnectAfrik
      </a>
    </p>

    ${helpLine}

    <p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      The ConnectAfrik Team
    </p>
  `
}

export function getWelcomeEmailText(userName: string): string {
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const helpLine = support
    ? `Need help? Reply to this email or contact us at ${support}.\n`
    : `Support: ${base}/support\n`

  return `Welcome to ConnectAfrik!

Hi ${userName},

Welcome to ConnectAfrik! Your account is active and ready to use.

Here is what you can do next:
1. Complete your profile – Add a photo, bio, and share your story.
2. Find friends & connect – Search by country, city, or interests.
3. Explore the marketplace – Buy and sell African products and services.
4. Join groups – Connect around culture, business, and more.

Visit: ${base}/feed

${helpLine}
The ConnectAfrik Team
`
}
