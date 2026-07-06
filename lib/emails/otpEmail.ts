import { EMAIL_THEME, emailHeadlineHtml } from './emailTheme'
import { EmailTemplate } from './EmailTemplate'

const PURPOSE_COPY: Record<string, { subject: string; headline: string; preheader: string }> = {
  signup: {
    subject: 'Your ConnectAfrik verification code',
    headline: 'Verify your email',
    preheader: 'Enter this code to continue creating your ConnectAfrik account.',
  },
  login: {
    subject: 'Your ConnectAfrik sign-in code',
    headline: 'Verify your email to sign in',
    preheader: 'Enter this code to verify your email and continue signing in.',
  },
  recovery: {
    subject: 'Your ConnectAfrik password reset code',
    headline: 'Reset your password',
    preheader: 'Enter this code to reset your ConnectAfrik password.',
  },
}

export function getOtpEmailHtml(code: string, purpose: string): string {
  const copy = PURPOSE_COPY[purpose] ?? PURPOSE_COPY.signup

  const content = `
    ${emailHeadlineHtml(copy.headline)}
    <p style="font-size:16px;color:${EMAIL_THEME.text};margin:0 0 20px;font-weight:500;text-align:center;">
      Use the verification code below. It expires in 10 minutes.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;padding:16px 28px;border-radius:12px;background:${EMAIL_THEME.infoBg};border:1px solid ${EMAIL_THEME.border};letter-spacing:8px;font-size:32px;font-weight:700;color:${EMAIL_THEME.heading};font-family:monospace;">
        ${code}
      </div>
    </div>
    <p style="font-size:13px;color:${EMAIL_THEME.textMuted};margin:0;text-align:center;line-height:1.5;">
      If you did not request this code, you can safely ignore this email.
    </p>`

  return EmailTemplate({
    content,
    subject: copy.subject,
    headerTitle: 'ConnectAfrik',
    headerSubtitle: 'Secure verification',
    preheader: copy.preheader,
  })
}

export function getOtpEmailText(code: string, purpose: string): string {
  const copy = PURPOSE_COPY[purpose] ?? PURPOSE_COPY.signup
  return `${copy.headline}

Your verification code is: ${code}

This code expires in 10 minutes.

If you did not request this code, you can safely ignore this email.

ConnectAfrik — Uniting Africans and the diaspora worldwide`
}
