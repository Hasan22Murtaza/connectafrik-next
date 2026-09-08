/**
 * Email design tokens + reusable content helpers.
 *
 * Matches the ConnectAfrik transactional template: light grey canvas, white
 * rounded card, navy wordmark, serif headline, and a full-width coral CTA.
 */
import { escapeHtml, getAppBaseUrl } from './utils'
import { getShared } from './content'

export const EMAIL_THEME = {
  gradient: 'linear-gradient(180deg, #FF8A5C 0%, #FF5A36 100%)',
  brand: '#FF5A36',
  brandDark: '#E85A32',
  navy: '#1B2437',
  bodyBg: '#F3F4F6',
  cardBg: '#ffffff',
  footerBg: '#ffffff',
  heading: '#1B2437',
  text: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E8EAED',
  link: '#FF5A36',
  badgeBg: '#FFE8DC',
  badgeText: '#E85A32',
  successBg: '#F0FDF4',
  successAccent: '#22C55E',
  infoBg: '#F8FAFC',
  infoAccent: '#3B82F6',
  warnBg: '#FFFBEB',
  warnAccent: '#F59E0B',
  warnText: '#92400E',
  dangerBg: '#FEF2F2',
  dangerAccent: '#EF4444',
  shadowCard: '0 8px 24px rgba(27, 36, 55, 0.06)',
  shadowButton: '0 6px 16px rgba(255, 90, 54, 0.28)',
  fontSans:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSerif: "Georgia, 'Iowan Old Style', Palatino, 'Palatino Linotype', 'Times New Roman', serif",
} as const

/** ConnectAfrik text wordmark (navy, bold sans-serif) — header left and footer center. */
export function emailWordmarkHtml(options?: { align?: 'left' | 'center'; size?: number }): string {
  const shared = getShared()
  const align = options?.align ?? 'left'
  const size = options?.size ?? 22
  const base = getAppBaseUrl()
  const href = base || '#'
  return `<a href="${escapeHtml(href)}" style="display:inline-block;font-family:${EMAIL_THEME.fontSans};font-size:${size}px;font-weight:800;letter-spacing:-0.03em;color:${EMAIL_THEME.navy};text-decoration:none;line-height:1.2;">${shared.brand}</a>`
}

/** Peach status pill used in the top-right of the header. */
export function emailBadgeHtml(label: string): string {
  if (!label.trim()) return ''
  return `<span style="display:inline-block;background:${EMAIL_THEME.badgeBg};color:${EMAIL_THEME.badgeText};font-family:${EMAIL_THEME.fontSans};font-size:12px;font-weight:600;line-height:1;padding:8px 12px;border-radius:999px;white-space:nowrap;">${label}</span>`
}

/** Serif section headline inside the content card. */
export function emailHeadlineHtml(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${EMAIL_THEME.fontSerif};font-size:28px;font-weight:600;line-height:1.25;color:${EMAIL_THEME.heading};text-align:left;">${text}</h1>`
}

/** Lead paragraph under the headline. */
export function emailLeadHtml(text: string): string {
  return `<p style="margin:0 0 24px;font-family:${EMAIL_THEME.fontSans};font-size:15px;line-height:1.65;color:${EMAIL_THEME.text};text-align:left;">${text}</p>`
}

/** Standard body paragraph. */
export function emailParagraphHtml(text: string, align: 'left' | 'center' = 'left'): string {
  return `<p style="margin:0 0 16px;font-family:${EMAIL_THEME.fontSans};font-size:15px;line-height:1.65;color:${EMAIL_THEME.text};text-align:${align};">${text}</p>`
}

/** Full-width coral gradient CTA, matching the transactional template. */
export function emailButtonHtml(href: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="button-container" style="margin:28px 0 12px;">
      <tr>
        <td>
          <a href="${href}" class="email-button" style="display:block;width:100%;box-sizing:border-box;background-color:${EMAIL_THEME.brand};background-image:${EMAIL_THEME.gradient};color:#ffffff;padding:16px 24px;text-align:center;text-decoration:none;border-radius:10px;font-family:${EMAIL_THEME.fontSans};font-weight:700;font-size:16px;line-height:1.2;box-shadow:${EMAIL_THEME.shadowButton};letter-spacing:0.01em;">${label}</a>
        </td>
      </tr>
    </table>`
}

/** Muted helper line under a CTA. */
export function emailHintHtml(text: string): string {
  if (!text.trim()) return ''
  return `<p style="text-align:center;margin:0 0 8px;font-family:${EMAIL_THEME.fontSans};font-size:13px;line-height:1.5;color:${EMAIL_THEME.textMuted};">${text}</p>`
}

/** Secondary text link, centered. */
export function emailSecondaryLinkHtml(href: string, label: string): string {
  return `<p style="text-align:center;margin:0 0 8px;"><a href="${href}" style="font-family:${EMAIL_THEME.fontSans};font-size:14px;color:${EMAIL_THEME.link};text-decoration:underline;">${label}</a></p>`
}

export type EmailBoxVariant = 'success' | 'info' | 'warn' | 'danger'

function variantPalette(variant: EmailBoxVariant) {
  return {
    success: { bg: EMAIL_THEME.successBg, accent: EMAIL_THEME.successAccent },
    info: { bg: EMAIL_THEME.cardBg, accent: EMAIL_THEME.infoAccent },
    warn: { bg: EMAIL_THEME.warnBg, accent: EMAIL_THEME.warnAccent },
    danger: { bg: EMAIL_THEME.dangerBg, accent: EMAIL_THEME.dangerAccent },
  }[variant]
}

/** Bordered inner card for previews, summaries, and tips. */
export function emailAccentBoxHtml(options: {
  variant?: EmailBoxVariant
  eyebrow?: string
  bodyHtml: string
}): string {
  const { variant = 'info', eyebrow, bodyHtml } = options
  const palette = variantPalette(variant)

  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 8px;font-family:${EMAIL_THEME.fontSans};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${palette.accent};">${eyebrow}</p>`
    : ''

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${EMAIL_THEME.border};border-radius:12px;background:${palette.bg};">
      <tr>
        <td style="padding:18px 20px;">
          ${eyebrowHtml}
          ${bodyHtml}
        </td>
      </tr>
    </table>`
}

/**
 * Featured status card from the transactional template: circular accent,
 * title, subtitle, and optional footer line.
 */
export function emailStatusCardHtml(options: {
  title: string
  subtitle?: string
  footer?: string
  variant?: EmailBoxVariant
}): string {
  const { title, subtitle, footer, variant = 'success' } = options
  const palette = variantPalette(variant)
  const mark = variant === 'danger' ? '!' : variant === 'warn' ? '!' : '✓'
  const subtitleHtml = subtitle
    ? `<p style="margin:4px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:13px;line-height:1.4;color:${EMAIL_THEME.textMuted};">${subtitle}</p>`
    : ''
  const footerHtml = footer
    ? `<p style="margin:14px 0 0;padding-top:14px;border-top:1px solid ${EMAIL_THEME.border};font-family:${EMAIL_THEME.fontSans};font-size:13px;line-height:1.5;color:${EMAIL_THEME.text};">${footer}</p>`
    : ''

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;border:1px solid ${EMAIL_THEME.border};border-radius:12px;background:${EMAIL_THEME.cardBg};">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="top" width="44" style="width:44px;padding-right:12px;">
                <div style="width:36px;height:36px;border-radius:18px;background:${palette.accent};color:#ffffff;font-family:${EMAIL_THEME.fontSans};font-size:16px;font-weight:700;line-height:36px;text-align:center;">${mark}</div>
              </td>
              <td valign="middle">
                <p style="margin:0;font-family:${EMAIL_THEME.fontSans};font-size:15px;font-weight:700;line-height:1.35;color:${EMAIL_THEME.heading};">${title}</p>
                ${subtitleHtml}
              </td>
            </tr>
          </table>
          ${footerHtml}
        </td>
      </tr>
    </table>`
}

export function emailBoxBodyHtml(text: string): string {
  return `<p style="margin:0;font-family:${EMAIL_THEME.fontSans};font-size:14px;line-height:1.6;color:${EMAIL_THEME.text};">${text}</p>`
}

/** A single label/value row for summary tables. */
export function emailDetailRowHtml(label: string, value: string, emphasize = false): string {
  const valueStyle = emphasize
    ? `font-size:16px;font-weight:700;color:${EMAIL_THEME.heading};`
    : `font-size:14px;font-weight:600;color:${EMAIL_THEME.heading};`
  return `
    <tr>
      <td style="padding:6px 0;font-family:${EMAIL_THEME.fontSans};font-size:14px;color:${EMAIL_THEME.text};">${label}</td>
      <td align="right" style="padding:6px 0;font-family:${EMAIL_THEME.fontSans};${valueStyle}">${value}</td>
    </tr>`
}

/** Wrap detail rows in a bordered summary card. */
export function emailDetailTableHtml(rowsHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${EMAIL_THEME.border};border-radius:12px;">
      <tr>
        <td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
        </td>
      </tr>
    </table>`
}

/** Sign-off line, e.g. "Keep posting," + The ConnectAfrik team. */
export function emailSignOffHtml(lead: string): string {
  const team = getShared().teamName
  return `
    <p style="margin:28px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:15px;line-height:1.5;color:${EMAIL_THEME.heading};text-align:left;">
      ${lead}<br />
      <span style="color:${EMAIL_THEME.heading};font-weight:700;">${team}</span>
    </p>`
}

/** Centered support / help-center line used under CTAs. */
export function emailHelpHtml(options?: { extraHref?: string; extraLabel?: string }): string {
  const shared = getShared()
  const supportPlain = supportEmailPlain()
  const base = getAppBaseUrl()
  const extra =
    options?.extraHref && options?.extraLabel
      ? ` ${shared.or} <a href="${escapeHtml(options.extraHref)}" style="color:${EMAIL_THEME.link};text-decoration:underline;">${escapeHtml(options.extraLabel)}</a>`
      : ''

  if (supportPlain) {
    return `<p style="margin:16px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:13px;line-height:1.55;color:${EMAIL_THEME.textMuted};text-align:center;">
      ${shared.questionsEmailPrefix}
      <a href="mailto:${escapeHtml(supportPlain)}" style="color:${EMAIL_THEME.link};text-decoration:underline;">${escapeHtml(supportPlain)}</a>${extra}.
    </p>`
  }

  return `<p style="margin:16px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:13px;line-height:1.55;color:${EMAIL_THEME.textMuted};text-align:center;">
    ${shared.questionsVisitPrefix} <a href="${base}/support" style="color:${EMAIL_THEME.link};text-decoration:underline;">${shared.helpCenterLabel}</a>${extra}.
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
