import { EmailContentWrapper } from './EmailContentWrapper'
import { EmailFooter } from './EmailFooter'
import { EmailHeader } from './EmailHeader'
import { EMAIL_THEME } from './emailTheme'
import { escapeHtml } from './utils'

export type EmailTemplateOptions = {
  content: string
  subject: string
  /**
   * @deprecated Gradient banner title. Kept so existing callers compile;
   * the header now shows the navy wordmark instead.
   */
  headerTitle?: string
  /**
   * @deprecated Unused visually. Kept so existing callers compile.
   */
  headerSubtitle?: string
  /** Inbox preview line (hidden in body); improves open rates when set. */
  preheader?: string
  /** Status pill next to the wordmark (e.g. "Live now", "Security"). */
  badge?: string
}

/**
 * Standard ConnectAfrik email shell — light canvas, white rounded card,
 * navy wordmark header, and branded footer.
 */
export function EmailTemplate(options: EmailTemplateOptions): string {
  const { content, subject, preheader, badge } = options

  const pill = badge?.trim() ?? ''
  const trimmedPreheader = preheader?.trim() ?? ''
  const pre = trimmedPreheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_THEME.bodyBg};opacity:0;">
         ${escapeHtml(trimmedPreheader)}&#847;&zwnj;&nbsp;
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(subject)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: ${EMAIL_THEME.fontSans};
      line-height: 1.6;
      color: ${EMAIL_THEME.text};
      background-color: ${EMAIL_THEME.bodyBg};
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${EMAIL_THEME.cardBg};
      border-radius: 20px;
      overflow: hidden;
      box-shadow: ${EMAIL_THEME.shadowCard};
    }
    .email-button {
      transition: box-shadow 0.2s ease;
    }
    .email-button:hover {
      box-shadow: 0 8px 20px rgba(255, 90, 54, 0.38) !important;
    }
    a {
      color: ${EMAIL_THEME.link};
    }
    @media only screen and (max-width: 600px) {
      .header {
        padding: 28px 24px 8px !important;
      }
      .content {
        padding: 20px 24px 28px !important;
      }
      .footer {
        padding: 24px 24px 28px !important;
      }
      .email-button {
        padding: 15px 20px !important;
        font-size: 15px !important;
      }
    }
  </style>
</head>
<body>
  ${pre}
  <div class="email-wrapper">
    ${EmailHeader(pill)}
    ${EmailContentWrapper(content)}
    ${EmailFooter()}
  </div>
</body>
</html>`
}
