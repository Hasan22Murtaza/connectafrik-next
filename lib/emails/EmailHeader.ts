import { getAppBaseUrl } from './utils'

/** Matches Swipped `EmailHeader.js` structure; ConnectAfrik logo and tagline. */
export function EmailHeader(): string {
  const baseUrl = getAppBaseUrl()
  const logoSrc = `${baseUrl}/assets/images/odin-logo.svg`

  return `
    <table style="width:100%;">
      <tbody>
        <tr>
          <td valign="top">
            <table class="es-header" align="center" style="width:100%;">
              <tbody>
                <tr>
                  <td align="center">
                    <table class="es-header-body" style="width:600px;">
                      <tbody>
                        <tr>
                          <td align="left" style="padding:10px;">
                            <table style="width:100%;">
                              <tbody>
                                <tr>
                                  <td valign="top" align="center" style="width:560px;">
                                    <a href="${baseUrl}" target="_blank">
                                      <img src="${logoSrc}" width="200" alt="ConnectAfrik" style="border:0; max-width: 20%;">
                                    </a>
                                    <p style="word-break: break-word; font-size: 20px; color: #B1AED1; margin-top:0px; margin-bottom:0px;">
                                      <strong>ConnectAfrik</strong> – Uniting Africans &amp; the diaspora worldwide
                                    </p>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  `
}
