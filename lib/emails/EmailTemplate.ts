import { EmailContentWrapper } from './EmailContentWrapper'
import { EmailFooter } from './EmailFooter'
import { EmailHeader } from './EmailHeader'
import { SWIPPED } from './swippedTheme'
import { escapeHtml } from './utils'

export type EmailTemplateOptions = {
  content: string
  subject: string
  /** Inbox preview line (hidden in body); improves open rates when set. */
  preheader?: string
}

/**
 * Full HTML document — header, content card, footer (modern transactional layout).
 */
export function EmailTemplate(options: EmailTemplateOptions): string {
  const { content, subject, preheader } = options
  const pre = preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#fff;opacity:0;">
         ${escapeHtml(pre)}&#847;&zwnj;&nbsp;
       </div>`
    : ''

  return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <meta charset="UTF-8">
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta content="telephone=no" name="format-detection">
        <title>${escapeHtml(subject)}</title>
        <style type="text/css">
          body {
            background-color:${SWIPPED.bodyBg};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          a { color: ${SWIPPED.link}; }
          @media only screen and (max-width: 620px) {
            .es-content { width: 100% !important; border-radius: 0 !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:24px 12px 40px;width:100%;background-color:${SWIPPED.bodyBg};">
        ${pre}
        <div style="max-width:600px;margin:0 auto;">
          ${EmailHeader()}
          ${EmailContentWrapper(`${content}${EmailFooter()}`)}
        </div>
      </body>
    </html>
  `
}
