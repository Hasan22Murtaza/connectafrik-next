import { SWIPPED } from './swippedTheme'
import { getAppBaseUrl } from './utils'

export function EmailHeader(): string {
  const baseUrl = getAppBaseUrl()
  const logoSrc = `${baseUrl}/assets/images/logo_2.png`

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td align="center" style="padding:24px 16px 8px;">
          <a href="${baseUrl}" target="_blank" style="text-decoration:none;display:inline-block;">
            <img src="${logoSrc}" width="160" alt="ConnectAfrik" style="border:0;height:auto;max-width:160px;display:block;">
          </a>
          <p style="margin:12px 0 0;font-size:13px;line-height:1.4;color:${SWIPPED.tagline};max-width:420px;">
            The network for Africans and the diaspora — community, culture, and commerce in one place.
          </p>
        </td>
      </tr>
    </table>
  `
}
