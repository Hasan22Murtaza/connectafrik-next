import { EmailTemplate } from './EmailTemplate'
import { EMAIL_THEME, emailButtonHtml, emailHeadlineHtml } from './emailTheme'
import { escapeHtml } from './utils'

export function getSignupConfirmationEmailHtml(confirmationUrl: string): string {
  const safeUrl = escapeHtml(confirmationUrl)

  const content = `
    ${emailHeadlineHtml('Confirm Your Account')}
    <p style="font-size:16px;color:${EMAIL_THEME.text};margin:0 0 25px;font-weight:500;text-align:center;">
      Click the button below to verify your email address and activate your account:
    </p>
    ${emailButtonHtml(safeUrl, 'Confirm Your Email')}
    <div style="margin-top:20px;padding-top:20px;border-top:1px solid ${EMAIL_THEME.border};text-align:center;">
      <p style="font-size:12px;color:${EMAIL_THEME.textMuted};margin-bottom:10px;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <a href="${safeUrl}" style="color:${EMAIL_THEME.link};text-decoration:none;word-break:break-all;font-size:11px;">${safeUrl}</a>
    </div>`

  return EmailTemplate({
    content,
    subject: 'Confirm your ConnectAfrik account',
    headerTitle: 'Welcome to ConnectAfrik!',
    headerSubtitle: 'Your journey to connect with the African diaspora starts here',
    preheader: 'Confirm your email to activate your ConnectAfrik account.',
  })
}

export function getSignupConfirmationEmailText(confirmationUrl: string): string {
  return `Welcome to ConnectAfrik!

Confirm Your Account

Click the link below to verify your email address and activate your account:

${confirmationUrl}

ConnectAfrik — Uniting Africans and the diaspora worldwide

This is an automated email. Please do not reply to this message.`
}
