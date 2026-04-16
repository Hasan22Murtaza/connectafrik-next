import { SWIPPED } from './swippedTheme'

/** Inner content card — centered, responsive width, works in Outlook-style table layouts. */
export function EmailContentWrapper(content: string): string {
  return `
      <table role="presentation" class="es-content" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background-color:${SWIPPED.cardBg};border-radius:12px;box-shadow:${SWIPPED.shadowCard};">
        <tbody>
          <tr>
            <td align="left" style="padding:32px 28px 36px;">
              ${content}
            </td>
          </tr>
        </tbody>
      </table>
      `
}
