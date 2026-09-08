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
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { getEmailCopy, getLabels, t } from './content'

export type OrderRefundEmailDetails = {
  buyerName: string
  orderNumber: string
  productTitle: string
  amount: number
  currency: string
  orderId?: string
  reason?: string | null
}

function refundVars(details: OrderRefundEmailDetails) {
  return {
    buyerName: details.buyerName,
    orderNumber: details.orderNumber,
    productTitle: details.productTitle,
    amount: `${getCurrencySymbol(details.currency)}${Number(details.amount || 0).toLocaleString()}`,
  }
}

function ordersUrl(details: OrderRefundEmailDetails): string {
  return details.orderId
    ? `${getAppBaseUrl()}/my-orders/${details.orderId}`
    : `${getAppBaseUrl()}/my-orders`
}

export function getOrderRefundInitiatedEmailHtml(details: OrderRefundEmailDetails): string {
  const copy = getEmailCopy('refundInitiated')
  const labels = getLabels()
  const vars = refundVars(details)
  const reasonHtml = details.reason?.trim()
    ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;">${t('{{reason}}', { reason: details.reason.trim() }, true)}</p>`
    : ''

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.leadHtml, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.orderNumber, t('{{orderNumber}}', vars, true)) +
        emailDetailRowHtml(labels.item, t('{{productTitle}}', vars, true)) +
        emailDetailRowHtml(labels.refundAmount, vars.amount, true)
    )}
    ${emailAccentBoxHtml({
      variant: 'info',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)) + reasonHtml,
    })}
    ${emailButtonHtml(ordersUrl(details), t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getOrderRefundInitiatedEmailText(details: OrderRefundEmailDetails): string {
  const copy = getEmailCopy('refundInitiated')
  return t(copy.text, {
    ...refundVars(details),
    reasonLine: details.reason?.trim() ? `\nReason: ${details.reason.trim()}\n` : '',
    ordersUrl: ordersUrl(details),
  })
}

export function getOrderRefundCompletedEmailHtml(details: OrderRefundEmailDetails): string {
  const copy = getEmailCopy('refundCompleted')
  const labels = getLabels()
  const vars = refundVars(details)

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.leadHtml, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.orderNumber, t('{{orderNumber}}', vars, true)) +
        emailDetailRowHtml(labels.item, t('{{productTitle}}', vars, true)) +
        emailDetailRowHtml(labels.refunded, vars.amount, true) +
        emailDetailRowHtml(labels.status, t(copy.statusLabel), true)
    )}
    ${emailAccentBoxHtml({
      variant: 'success',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(ordersUrl(details), t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getOrderRefundCompletedEmailText(details: OrderRefundEmailDetails): string {
  const copy = getEmailCopy('refundCompleted')
  return t(copy.text, { ...refundVars(details), ordersUrl: ordersUrl(details) })
}
