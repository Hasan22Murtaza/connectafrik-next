import { SWIPPED, supportEmailHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

/** Standard footer — app link, support, legal-style one-liner (modern transactional pattern). */
export function EmailFooter(): string {
  const base = getAppBaseUrl()
  const year = new Date().getFullYear()
  const supportDisplay = supportEmailHtml()
  const supportAddr = supportEmailPlain()
  const safeBase = escapeHtml(base)

  const supportLine =
    supportAddr && supportDisplay
      ? `<a href="mailto:${escapeHtml(supportAddr)}" style="color:${SWIPPED.link};text-decoration:none;">${supportDisplay}</a>`
      : `<a href="${base}/support" style="color:${SWIPPED.link};text-decoration:none;">Help center</a>`

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
      <tr>
        <td style="padding-top:24px;border-top:1px solid ${SWIPPED.borderSubtle};">
          <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${SWIPPED.mutedFooter};text-align:center;">
            <a href="${base}" style="color:${SWIPPED.mutedFooter};text-decoration:underline;">Open ConnectAfrik</a>
            &nbsp;·&nbsp;
            ${supportLine}
          </p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:${SWIPPED.mutedFooter};text-align:center;">
            © ${year} ConnectAfrik. You’re receiving this because of activity on your account.<br />
            <span style="color:${SWIPPED.borderSubtle};">${safeBase}</span>
          </p>
        </td>
      </tr>
    </table>
  `
}
