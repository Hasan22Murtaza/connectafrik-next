import { EMAIL_THEME, supportEmailHtml, supportEmailPlain } from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

/**
 * Branded footer — brand line, tagline, support link, copyright, and the
 * automated-message note. Matches the standard (signup confirmation) template.
 */
export function EmailFooter(): string {
  const base = getAppBaseUrl()
  const year = new Date().getFullYear()
  const supportDisplay = supportEmailHtml()
  const supportAddr = supportEmailPlain()

  const supportLine =
    supportAddr && supportDisplay
      ? `<p style="font-size:13px;color:${EMAIL_THEME.textMuted};margin:5px 0;">
          Need help? <a href="mailto:${escapeHtml(supportAddr)}" style="color:${EMAIL_THEME.link};text-decoration:none;">${supportDisplay}</a>
        </p>`
      : base
        ? `<p style="font-size:13px;color:${EMAIL_THEME.textMuted};margin:5px 0;">
            Need help? <a href="${base}/support" style="color:${EMAIL_THEME.link};text-decoration:none;">Visit our help center</a>
          </p>`
        : ''

  return `
    <div class="footer" style="background:${EMAIL_THEME.footerBg};padding:30px;text-align:center;border-top:1px solid ${EMAIL_THEME.border};">
      <p class="brand" style="color:${EMAIL_THEME.brand};font-weight:600;font-size:14px;margin:5px 0;">ConnectAfrik</p>
      <p style="font-size:13px;color:${EMAIL_THEME.textMuted};margin:5px 0;">Uniting Africans and the diaspora worldwide</p>
      ${supportLine}
      <p style="font-size:13px;color:${EMAIL_THEME.textMuted};margin:5px 0;">&copy; ${year} ConnectAfrik. All rights reserved.</p>
      <p style="margin-top:15px;font-size:11px;color:${EMAIL_THEME.textMuted};">This is an automated email. Please do not reply to this message.</p>
    </div>`
}
