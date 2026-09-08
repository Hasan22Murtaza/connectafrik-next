import { EMAIL_THEME } from './emailTheme'

/** Inner content area of the card — generous padding, matching the template. */
export function EmailContentWrapper(content: string): string {
  return `
    <div class="content" style="padding:24px 40px 12px;background:${EMAIL_THEME.cardBg};">
      ${content}
    </div>`
}
