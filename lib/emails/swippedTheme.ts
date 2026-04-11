/**
 * Visual tokens aligned with Swipped (`new-iVan/lib/emails/*`) for consistent HTML emails.
 */
import { escapeHtml } from './utils'

export const SWIPPED = {
  bodyBg: '#F5F9FF',
  text: '#0e0e0e',
  tagline: '#B1AED1',
  ctaBg: '#0052cc',
  ctaText: '#ffffff',
  /** Primary CTA — matches resetPasswordEmail.js */
  ctaInline:
    'background-color:#0052cc;color:white;padding:12px 20px;border-radius:4px;text-decoration:none;',
  /** Emphasized CTA — matches shopOrderPaymentEmail.js “Track your order” */
  ctaBold:
    'background-color:#0052cc;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;',
  greenBoxBg: '#f8f9fa',
  greenBorder: '#28a745',
  blueBoxBg: '#e3f2fd',
  blueBorder: '#2196f3',
  paymentBoxBg: '#d4edda',
  nextBoxBg: '#d1ecf1',
  nextBorder: '#17a2b8',
  warnBoxBg: '#fff3cd',
  warnText: '#856404',
  warnBorder: '#ffc107',
  mutedFooter: '#6c757d',
  borderSubtle: '#e9ecef',
} as const

/** Escaped support address for HTML, or empty if unset. */
export function supportEmailHtml(): string {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
  return email ? escapeHtml(email) : ''
}

export function supportEmailPlain(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || ''
}
