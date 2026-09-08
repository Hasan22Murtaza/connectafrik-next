import { emailBadgeHtml, emailWordmarkHtml } from './emailTheme'
import { escapeHtml } from './utils'

/**
 * Card header: navy ConnectAfrik wordmark on the left, optional status
 * badge on the right. Matches the transactional email template.
 */
export function EmailHeader(badge?: string): string {
  const badgeHtml = badge?.trim() ? emailBadgeHtml(escapeHtml(badge.trim())) : ''

  return `
    <table role="presentation" class="header" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:36px 40px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" align="left" style="padding:0;">
                ${emailWordmarkHtml({ align: 'left', size: 22 })}
              </td>
              ${
                badgeHtml
                  ? `<td valign="middle" align="right" style="padding:0 0 0 16px;">${badgeHtml}</td>`
                  : ''
              }
            </tr>
          </table>
        </td>
      </tr>
    </table>`
}
