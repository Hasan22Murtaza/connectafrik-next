import contentJson from './content.json'
import { escapeHtml } from './utils'

export type EmailVars = Record<string, string | number | null | undefined>

export type EmailCopy = {
  subject?: string
  subjectWithOrder?: string
  headerTitle?: string
  headerSubtitle?: string
  badge?: string
  preheader?: string
  headline?: string
  lead?: string
  leadHtml?: string
  buttonLabel?: string
  secondaryLinkLabel?: string
  signOff?: string
  eyebrow?: string
  boxBody?: string
  boxVariant?: string
  fallbackEyebrow?: string
  fallbackBoxBody?: string
  statusLabel?: string
  next?: string
  hint?: string
  codeHint?: string
  ignoreHint?: string
  footerFallbackLink?: string
  quantityLabel?: string
  recordsNote?: string
  summaryLabel?: string
  saleLabel?: string
  itemLabel?: string
  quantityField?: string
  buyerField?: string
  automatedSellerNote?: string
  greeting?: string
  previewEyebrow?: string
  fromEyebrow?: string
  statusTitle?: string
  statusSubtitle?: string
  statusFooter?: string
  defaultCtaLabel?: string
  defaultFailureReason?: string
  features?: { title: string; description: string }[]
  text?: string
  helpWithEmail?: string
  helpWithCenter?: string
  textTitle?: string
}

type ContentFile = {
  shared: Record<string, string>
  labels: Record<string, string>
  emails: Record<string, unknown>
}

const content = contentJson as ContentFile

export function interpolate(template: string, vars: EmailVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key]
    return value == null ? '' : String(value)
  })
}

export function interpolateHtml(template: string, vars: EmailVars): string {
  const escaped: EmailVars = {}
  for (const [key, value] of Object.entries(vars)) {
    escaped[key] = escapeHtml(String(value ?? ''))
  }
  return interpolate(template, escaped)
}

/** Fill a copy string. Pass `html: true` when the result is inserted into HTML. */
export function t(template: string | undefined, vars: EmailVars = {}, html = false): string {
  if (!template) return ''
  return html ? interpolateHtml(template, vars) : interpolate(template, vars)
}

export function getShared(): Record<string, string> {
  return content.shared
}

export function getLabels(): Record<string, string> {
  return content.labels
}

export function getEmailCopy(path: string): EmailCopy {
  const parts = path.split('.')
  let node: unknown = content.emails
  for (const part of parts) {
    if (!node || typeof node !== 'object') {
      throw new Error(`Unknown email copy path: ${path}`)
    }
    node = (node as Record<string, unknown>)[part]
  }
  if (!node || typeof node !== 'object') {
    throw new Error(`Unknown email copy path: ${path}`)
  }
  return node as EmailCopy
}

export function hasEmailCopy(path: string): boolean {
  try {
    getEmailCopy(path)
    return true
  } catch {
    return false
  }
}

export function getEmailMeta(path: string, vars: EmailVars = {}) {
  const copy = getEmailCopy(path)
  const subjectTemplate =
    vars.orderNumber && copy.subjectWithOrder ? copy.subjectWithOrder : copy.subject
  return {
    subject: t(subjectTemplate, vars),
    headerTitle: t(copy.headerTitle, vars),
    headerSubtitle: t(copy.headerSubtitle, vars),
    badge: t(copy.badge, vars),
    preheader: t(copy.preheader, vars),
  }
}
