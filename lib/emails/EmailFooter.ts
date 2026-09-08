import { EMAIL_THEME, emailWordmarkHtml, supportEmailHtml, supportEmailPlain } from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'
import { getShared, interpolate } from './content'

/**
 * Branded footer inside the white card: navy wordmark, tagline, help link,
 * and copyright — matching the transactional template.
 */
export function EmailFooter(): string {
  const base = getAppBaseUrl()
  const year = new Date().getFullYear()
  const shared = getShared()
  const supportDisplay = supportEmailHtml()
  const supportAddr = supportEmailPlain()

  const helpLink =
    supportAddr && supportDisplay
      ? `<a href="mailto:${escapeHtml(supportAddr)}" style="color:${EMAIL_THEME.link};text-decoration:underline;">${supportDisplay}</a>`
      : base
        ? `<a href="${base}/support" style="color:${EMAIL_THEME.link};text-decoration:underline;">${shared.visitHelpCenter}</a>`
        : ''

  const supportLine = helpLink
    ? `<p style="font-family:${EMAIL_THEME.fontSans};font-size:13px;color:${EMAIL_THEME.text};margin:12px 0 0;line-height:1.5;">
        ${shared.needHelp} ${helpLink}
      </p>`
    : ''

  return `
    <div class="footer" style="background:${EMAIL_THEME.footerBg};padding:28px 40px 36px;text-align:center;border-top:1px solid ${EMAIL_THEME.border};">
      <p style="margin:0 0 8px;">${emailWordmarkHtml({ align: 'center', size: 18 })}</p>
      <p style="font-family:${EMAIL_THEME.fontSans};font-size:13px;color:${EMAIL_THEME.textMuted};margin:0;line-height:1.5;">${shared.tagline}</p>
      ${supportLine}
      <p style="font-family:${EMAIL_THEME.fontSans};font-size:12px;color:${EMAIL_THEME.textMuted};margin:16px 0 0;line-height:1.5;">${interpolate(shared.copyright, { year })}</p>
    </div>`
}
