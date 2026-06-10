/**
 * Semantic design tokens for ConnectAfrik.
 *
 * CSS variables are the source of truth (see app/globals.css).
 * Use Tailwind utilities mapped in @theme inline:
 *   bg-surface, bg-surface-canvas, bg-surface-hover, bg-surface-input
 *   text-content, text-content-secondary, text-content-tertiary
 *   border-border, border-border-subtle
 *   text-primary, bg-primary, text-danger
 */

export const themeTokenClasses = {
  page: 'bg-surface-canvas text-content',
  card: 'bg-surface rounded-xl shadow-card',
  elevated: 'bg-surface-elevated rounded-lg shadow-dropdown border border-border',
  input: 'bg-surface-input text-content border border-border placeholder:text-content-tertiary focus:border-primary focus:ring-2 focus:ring-primary/25',
  navItem: 'text-content-secondary hover:text-primary-600',
  navItemActive: 'text-primary-600',
  menuItem: 'text-content hover:bg-surface-hover',
} as const
