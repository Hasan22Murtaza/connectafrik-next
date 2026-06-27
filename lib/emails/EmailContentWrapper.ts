import { EMAIL_THEME } from './emailTheme'

/** Inner content area of the card — generous padding, matching the standard template. */
export function EmailContentWrapper(content: string): string {
  return `
    <div class="content" style="padding:40px 30px;background:${EMAIL_THEME.cardBg};">
      ${content}
    </div>`
}
