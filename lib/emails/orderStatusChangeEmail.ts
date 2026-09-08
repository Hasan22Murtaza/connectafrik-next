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
  supportEmailPlain,
  type EmailBoxVariant,
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { formatOrderStatus } from '@/lib/marketplace/orderStatus'
import { getEmailCopy, getEmailMeta, getLabels, hasEmailCopy, t } from './content'

export type OrderStatusChangeDetails = {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
  newStatus: string
  orderId?: string
}

function statusKey(status: string): string {
  return (status || '').toLowerCase()
}

function statusCopyPath(status: string): string {
  const key = statusKey(status)
  const path = `orderStatus.${key}`
  return hasEmailCopy(path) ? path : 'orderStatus.fallback'
}

export function getOrderStatusChangeEmailSubject(details: OrderStatusChangeDetails): string {
  const { orderNumber, newStatus } = details
  const statusLabel = formatOrderStatus(newStatus)
  return t(getEmailCopy(statusCopyPath(newStatus)).subject, { orderNumber, statusLabel })
}

export function getOrderStatusChangeEmailMeta(details: OrderStatusChangeDetails): {
  headerTitle: string
  headerSubtitle: string
  badge: string
  preheader: string
} {
  const statusLabel = formatOrderStatus(details.newStatus)
  const vars = { orderNumber: details.orderNumber, statusLabel }
  const meta = getEmailMeta(statusCopyPath(details.newStatus), vars)
  return {
    headerTitle: meta.headerTitle,
    headerSubtitle: meta.headerSubtitle,
    badge: meta.badge,
    preheader: meta.preheader,
  }
}

export function getOrderStatusChangeEmailHtml(details: OrderStatusChangeDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, newStatus, orderId } =
    details
  const layout = getEmailCopy('orderStatus')
  const copy = getEmailCopy(statusCopyPath(newStatus))
  const labels = getLabels()
  const statusLabel = formatOrderStatus(newStatus)
  const vars = { orderNumber, statusLabel, buyerName }
  const amountStr = `${getCurrencySymbol(currency)}${Number(totalAmount || 0).toLocaleString()}`
  const ordersUrl = orderId ? `${getAppBaseUrl()}/my-orders/${orderId}` : `${getAppBaseUrl()}/my-orders`
  const itemValue = t('{{productTitle}} × {{quantity}}', { productTitle, quantity }, true)

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(`Hi ${t('{{buyerName}}', { buyerName }, true)} — ${t(copy.leadHtml, vars, true)}`)}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.orderNumber, t('{{orderNumber}}', { orderNumber }, true)) +
        emailDetailRowHtml(labels.item, itemValue) +
        emailDetailRowHtml(labels.amount, amountStr) +
        emailDetailRowHtml(labels.status, t('{{statusLabel}}', { statusLabel }, true), true)
    )}
    ${emailAccentBoxHtml({
      variant: (copy.boxVariant as EmailBoxVariant) || 'info',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.next, vars, true)),
    })}
    ${emailButtonHtml(ordersUrl, t(layout.buttonLabel))}
    ${emailHelpHtml({ extraHref: ordersUrl, extraLabel: labels.yourOrders })}
    ${emailSignOffHtml(t(layout.signOff))}
  `
}

export function getOrderStatusChangeEmailText(details: OrderStatusChangeDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, newStatus, orderId } =
    details
  const layout = getEmailCopy('orderStatus')
  const copy = getEmailCopy(statusCopyPath(newStatus))
  const statusLabel = formatOrderStatus(newStatus)
  const vars = { orderNumber, statusLabel, buyerName }
  const ordersUrl = orderId ? `${getAppBaseUrl()}/my-orders/${orderId}` : `${getAppBaseUrl()}/my-orders`
  const support = supportEmailPlain()
  const helpLine = support ? `Questions? ${support}\n` : `Help: ${getAppBaseUrl()}/support\n`
  const plainLead = t(copy.leadHtml, vars).replace(/<[^>]+>/g, '')

  return `${t(layout.textTitle, { orderNumber })}

Hi ${buyerName},

${plainLead}

Item: ${productTitle} × ${quantity}
Amount: ${getCurrencySymbol(currency)}${Number(totalAmount || 0).toLocaleString()}
Status: ${statusLabel}

${t(copy.next, vars)}

${t(layout.buttonLabel)}: ${ordersUrl}
${helpLine}
— The ConnectAfrik team
`
}
