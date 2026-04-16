/**
 * Email design tokens — readable in all major clients, aligned with ConnectAfrik branding.
 */
import { escapeHtml } from './utils'

export const SWIPPED = {
  bodyBg: '#f4f4f5',
  cardBg: '#ffffff',
  text: '#18181b',
  textSecondary: '#52525b',
  tagline: '#71717a',
  link: '#ea580c',
  ctaBg: '#ea580c',
  ctaText: '#ffffff',
  ctaHover: '#c2410c',
  /** Primary button (inline) */
  ctaInline:
    'background-color:#ea580c;color:#ffffff;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;',
  /** Secondary emphasis */
  ctaBold:
    'background-color:#ea580c;color:#ffffff;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;',
  greenBoxBg: '#f0fdf4',
  greenBorder: '#22c55e',
  blueBoxBg: '#eff6ff',
  blueBorder: '#3b82f6',
  paymentBoxBg: '#ecfdf5',
  nextBoxBg: '#f0f9ff',
  nextBorder: '#0ea5e9',
  warnBoxBg: '#fffbeb',
  warnText: '#92400e',
  warnBorder: '#f59e0b',
  mutedFooter: '#71717a',
  borderSubtle: '#e4e4e7',
  shadowCard: '0 1px 3px rgba(0,0,0,0.06)',
} as const

/** Large title — use once per email */
export function emailHeadlineHtml(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;line-height:1.25;color:${SWIPPED.text};letter-spacing:-0.02em;">${text}</h1>`
}

/** Subtitle under headline */
export function emailLeadHtml(text: string): string {
  return `<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:${SWIPPED.textSecondary};">${text}</p>`
}

/** Escaped support address for HTML, or empty if unset. */
export function supportEmailHtml(): string {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
  return email ? escapeHtml(email) : ''
}

export function supportEmailPlain(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || ''
}
