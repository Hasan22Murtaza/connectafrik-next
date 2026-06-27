import { EmailContentWrapper } from './EmailContentWrapper'
import { EmailFooter } from './EmailFooter'
import { EmailHeader } from './EmailHeader'
import { EMAIL_THEME } from './emailTheme'
import { escapeHtml } from './utils'

export type EmailTemplateOptions = {
  content: string
  subject: string
  /** Gradient banner title (e.g. "Welcome to ConnectAfrik!"). */
  headerTitle?: string
  /** Gradient banner subtitle shown under the title. */
  headerSubtitle?: string
  /** Inbox preview line (hidden in body); improves open rates when set. */
  preheader?: string
}

const DEFAULT_HEADER_TITLE = 'ConnectAfrik'
const DEFAULT_HEADER_SUBTITLE = 'Uniting Africans and the diaspora worldwide'

/**
 * Standard ConnectAfrik email shell — gradient banner header, white rounded
 * content card, and branded footer. This is the single source of truth for
 * every transactional email's structure, styling, branding, and layout.
 */
export function EmailTemplate(options: EmailTemplateOptions): string {
  const {
    content,
    subject,
    headerTitle = DEFAULT_HEADER_TITLE,
    headerSubtitle = DEFAULT_HEADER_SUBTITLE,
    preheader,
  } = options

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${EMAIL_THEME.text};
      background-color: ${EMAIL_THEME.bodyBg};
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${EMAIL_THEME.cardBg};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: ${EMAIL_THEME.shadowCard};
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/></svg>') repeat;
      opacity: 0.3;
    }
    .email-button {
      transition: all 0.3s ease;
    }
    .email-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4) !important;
    }
    a {
      color: ${EMAIL_THEME.link};
    }
    @media only screen and (max-width: 600px) {
      .header {
        padding: 40px 20px !important;
      }
      .header h1 {
        font-size: 26px !important;
      }
      .content {
        padding: 30px 20px !important;
      }
      .email-button {
        padding: 14px 30px !important;
        font-size: 15px !important;
      }
    }
  </style>
</head>
<body>
  ${pre}
  <div class="email-wrapper">
    ${EmailHeader(headerTitle, headerSubtitle)}
    ${EmailContentWrapper(content)}
    ${EmailFooter()}
  </div>
</body>
</html>`
}
