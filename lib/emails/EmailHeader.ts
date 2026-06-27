import { EMAIL_THEME } from './emailTheme'
import { escapeHtml } from './utils'

/**
 * Gradient banner header — title + subtitle, matching the standard
 * (signup confirmation) template. Decorative SVG overlay adds depth.
 */
export function EmailHeader(title: string, subtitle: string): string {
  const subtitleHtml = subtitle
    ? `<p style="font-size:16px;opacity:0.95;position:relative;z-index:1;margin:0;">${escapeHtml(subtitle)}</p>`
    : ''

  return `
    <div class="header" style="background:${EMAIL_THEME.gradient};color:#ffffff;padding:50px 30px;text-align:center;position:relative;">
      <h1 style="font-size:32px;font-weight:700;margin:0 0 10px;position:relative;z-index:1;">${escapeHtml(title)}</h1>
      ${subtitleHtml}
    </div>`
}
