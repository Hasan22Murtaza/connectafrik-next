/**
 * Email design tokens + reusable content helpers.
 *
 * The single source of truth for ConnectAfrik email branding. Mirrors the
 * signup confirmation template: warm orange gradient banner, white rounded
 * card, gradient CTA button, and a soft branded footer. Helpers emit
 * inline-styled HTML so the look survives across email clients.
 */
import { escapeHtml } from './utils'

export const EMAIL_THEME = {
  gradient: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
  brand: '#FF6B35',
  brandDark: '#F7931E',
  bodyBg: '#f5f5f5',
  cardBg: '#ffffff',
  footerBg: '#f9f9f9',
  heading: '#1a1a1a',
  text: '#333333',
  textMuted: '#999999',
  border: '#e0e0e0',
  link: '#FF6B35',
  /** Subtle, on-brand semantic accent boxes */
  successBg: '#f0fdf4',
  successAccent: '#22c55e',
  infoBg: '#eff6ff',
  infoAccent: '#3b82f6',
  warnBg: '#fffbeb',
  warnAccent: '#f59e0b',
  warnText: '#92400e',
  shadowCard: '0 4px 6px rgba(0, 0, 0, 0.1)',
  shadowButton: '0 4px 12px rgba(255, 107, 53, 0.3)',
} as const

/** Section headline inside the content card — use once near the top of each email. */
export function emailHeadlineHtml(text: string): string {
  return `<h2 style="margin:0 0 12px;font-size:24px;font-weight:600;line-height:1.3;color:${EMAIL_THEME.heading};text-align:center;">${text}</h2>`
}

/** Lead paragraph under the headline. */
export function emailLeadHtml(text: string): string {
  return `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${EMAIL_THEME.text};text-align:center;">${text}</p>`
}

/** Standard body paragraph. */
export function emailParagraphHtml(text: string, align: 'left' | 'center' = 'left'): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_THEME.text};text-align:${align};">${text}</p>`
}

/** Primary gradient CTA button (uses the shell's .email-button class for hover + responsiveness). */
export function emailButtonHtml(href: string, label: string): string {
  return `
    <div class="button-container" style="text-align:center;margin:30px 0;">
      <a href="${href}" class="email-button" style="display:inline-block;background:${EMAIL_THEME.gradient};color:#ffffff;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;box-shadow:${EMAIL_THEME.shadowButton};letter-spacing:0.5px;">${label}</a>
    </div>`
}

/** Secondary text link, centered. */
export function emailSecondaryLinkHtml(href: string, label: string): string {
  return `<p style="text-align:center;margin:0 0 8px;"><a href="${href}" style="font-size:14px;color:${EMAIL_THEME.link};text-decoration:underline;">${label}</a></p>`
}

export type EmailBoxVariant = 'success' | 'info' | 'warn'

/** Soft accent box with an optional eyebrow label — for previews, summaries, and tips. */
export function emailAccentBoxHtml(options: {
  variant?: EmailBoxVariant
  eyebrow?: string
  bodyHtml: string
}): string {
  const { variant = 'info', eyebrow, bodyHtml } = options
  const palette = {
    success: { bg: EMAIL_THEME.successBg, accent: EMAIL_THEME.successAccent },
    info: { bg: EMAIL_THEME.infoBg, accent: EMAIL_THEME.infoAccent },
    warn: { bg: EMAIL_THEME.warnBg, accent: EMAIL_THEME.warnAccent },
  }[variant]

  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${palette.accent};">${eyebrow}</p>`
    : ''

  return `
    <div style="background-color:${palette.bg};padding:18px 20px;border-radius:10px;border-left:4px solid ${palette.accent};margin:0 0 24px;">
      ${eyebrowHtml}
      ${bodyHtml}
    </div>`
}

/** A single label/value row for summary tables. */
export function emailDetailRowHtml(label: string, value: string, emphasize = false): string {
  const valueStyle = emphasize
    ? `font-size:16px;font-weight:700;color:${EMAIL_THEME.heading};`
    : `font-size:14px;font-weight:600;color:${EMAIL_THEME.heading};`
  return `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${EMAIL_THEME.text};">${label}</td>
      <td align="right" style="padding:6px 0;${valueStyle}">${value}</td>
    </tr>`
}

/** Wrap detail rows in a bordered summary card. */
export function emailDetailTableHtml(rowsHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${EMAIL_THEME.border};border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
        </td>
      </tr>
    </table>`
}

/** Sign-off line, e.g. "— The ConnectAfrik team". */
export function emailSignOffHtml(lead: string): string {
  return `
    <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${EMAIL_THEME.text};">
      ${lead}<br />
      <span style="color:${EMAIL_THEME.heading};font-weight:600;">The ConnectAfrik team</span>
    </p>`
}

/** Escaped support address for HTML, or empty if unset. */
export function supportEmailHtml(): string {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
  return email ? escapeHtml(email) : ''
}

export function supportEmailPlain(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || ''
}
