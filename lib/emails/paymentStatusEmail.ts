import { getCurrencySymbol } from './currency'
import {
  emailAccentBoxHtml,
  emailBoxBodyHtml,
  emailButtonHtml,
  emailDetailRowHtml,
  emailDetailTableHtml,
  emailHeadlineHtml,
  emailHelpHtml,
  emailLeadHtml,
  emailSignOffHtml,
  type EmailBoxVariant,
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { getEmailCopy, getEmailMeta, getLabels, t, type EmailCopy } from './content'

export type PaymentStatus = 'successful' | 'failed' | 'pending'

export type PaymentEmailDetails = {
  buyerName: string
  amount: number
  currency: string
  productTitle?: string | null
  orderNumber?: string | null
  orderId?: string | null
}

export type PaymentCopy = {
  subject: string
  headerTitle: string
  headerSubtitle: string
  badge: string
  headline: string
  lead: string
  next: string
  preheader: string
  buttonLabel: string
  boxVariant: EmailBoxVariant
  eyebrow: string
  statusLabel: string
}

function paymentVars(details: PaymentEmailDetails) {
  const amount = `${getCurrencySymbol(details.currency)}${Number(details.amount || 0).toLocaleString()}`
  const orderBit = details.orderNumber ? ` for order ${details.orderNumber}` : ''
  return {
    buyerName: details.buyerName,
    amount,
    orderBit,
    orderNumber: details.orderNumber || '',
    productTitle: details.productTitle || '',
  }
}

export function getPaymentEmailCopy(
  status: PaymentStatus,
  details: PaymentEmailDetails
): PaymentCopy {
  const copy = getEmailCopy(`payment.${status}`)
  const vars = paymentVars(details)
  const meta = getEmailMeta(`payment.${status}`, vars)
  return {
    subject: meta.subject,
    headerTitle: meta.headerTitle,
    headerSubtitle: meta.headerSubtitle,
    badge: meta.badge,
    headline: t(copy.headline, vars),
    lead: t(copy.lead, vars),
    next: t(copy.next, vars),
    preheader: meta.preheader,
    buttonLabel: t(copy.buttonLabel),
    boxVariant: (copy.boxVariant as EmailBoxVariant) || 'info',
    eyebrow: t(copy.eyebrow),
    statusLabel: t(copy.statusLabel),
  }
}

export function getPaymentEmailHtml(status: PaymentStatus, details: PaymentEmailDetails): string {
  const copy = getEmailCopy(`payment.${status}`) as EmailCopy
  const filled = getPaymentEmailCopy(status, details)
  const labels = getLabels()
  const vars = paymentVars(details)
  const ordersUrl = details.orderId
    ? `${getAppBaseUrl()}/my-orders/${details.orderId}`
    : `${getAppBaseUrl()}/my-orders`
  const href = status === 'failed' ? `${getAppBaseUrl()}/marketplace` : ordersUrl

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(`Hi ${t('{{buyerName}}', vars, true)} — ${t(copy.lead, vars, true)}`)}
    ${emailDetailTableHtml(
      (details.orderNumber
        ? emailDetailRowHtml(labels.orderNumber, t('{{orderNumber}}', vars, true))
        : '') +
        (details.productTitle
          ? emailDetailRowHtml(labels.item, t('{{productTitle}}', vars, true))
          : '') +
        emailDetailRowHtml(labels.amount, vars.amount) +
        emailDetailRowHtml(labels.status, filled.statusLabel, true)
    )}
    ${emailAccentBoxHtml({
      variant: filled.boxVariant,
      eyebrow: filled.eyebrow,
      bodyHtml: emailBoxBodyHtml(t(copy.next, vars, true)),
    })}
    ${emailButtonHtml(href, filled.buttonLabel)}
    ${emailHelpHtml({ extraHref: ordersUrl, extraLabel: labels.yourOrders })}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getPaymentEmailText(status: PaymentStatus, details: PaymentEmailDetails): string {
  const filled = getPaymentEmailCopy(status, details)
  const vars = paymentVars(details)
  const ordersUrl = details.orderId
    ? `${getAppBaseUrl()}/my-orders/${details.orderId}`
    : `${getAppBaseUrl()}/my-orders`
  const href = status === 'failed' ? `${getAppBaseUrl()}/marketplace` : ordersUrl

  return `${filled.headline}

Hi ${details.buyerName},

${filled.lead}

${details.orderNumber ? `Order: ${details.orderNumber}\n` : ''}${
    details.productTitle ? `Item: ${details.productTitle}\n` : ''
  }Amount: ${vars.amount}
Status: ${filled.statusLabel}

${filled.next}

${filled.buttonLabel}: ${href}

— The ConnectAfrik team
`
}
