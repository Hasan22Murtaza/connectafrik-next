import { getCurrencySymbol } from './currency'
import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailBoxBodyHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailHelpHtml,
  emailHintHtml,
  emailLeadHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { getEmailCopy, getLabels, t } from './content'

type OrderConfirmationDetails = {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
}

export function getOrderConfirmationEmailHtml(orderDetails: OrderConfirmationDetails): string {
  const copy = getEmailCopy('orderConfirmation')
  const labels = getLabels()
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = orderDetails
  const vars = { orderNumber, productTitle, quantity, buyerName }
  const amountStr = `${getCurrencySymbol(currency)}${totalAmount.toLocaleString()}`
  const ordersUrl = `${getAppBaseUrl()}/my-orders`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.leadHtml, vars, true))}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${EMAIL_THEME.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;background-color:${EMAIL_THEME.successBg};border-bottom:1px solid ${EMAIL_THEME.border};">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${EMAIL_THEME.successAccent};">${t(copy.summaryLabel)}</p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:${EMAIL_THEME.heading};">${t('{{productTitle}}', vars, true)}</p>
          <p style="margin:4px 0 0;font-size:14px;color:${EMAIL_THEME.text};">${t(copy.quantityLabel, vars)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:${EMAIL_THEME.text};">${labels.orderNumber}</td>
              <td align="right" style="font-size:14px;font-weight:600;color:${EMAIL_THEME.heading};">${t('{{orderNumber}}', vars, true)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:12px 0;border-bottom:1px solid ${EMAIL_THEME.border};"></td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:14px;color:${EMAIL_THEME.text};">${labels.amountPaid}</td>
              <td align="right" style="padding-top:12px;font-size:16px;font-weight:700;color:${EMAIL_THEME.heading};">${amountStr}</td>
            </tr>
            <tr>
              <td style="padding-top:6px;font-size:14px;color:${EMAIL_THEME.text};">${labels.status}</td>
              <td align="right" style="padding-top:6px;font-size:14px;font-weight:600;color:${EMAIL_THEME.successAccent};">${t(copy.statusLabel)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${emailAccentBoxHtml({
      variant: 'info',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}

    ${emailButtonHtml(ordersUrl, t(copy.buttonLabel))}
    ${emailHintHtml(t(copy.recordsNote))}
    ${emailHelpHtml({ extraHref: ordersUrl, extraLabel: labels.yourOrders })}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getOrderConfirmationEmailText(orderDetails: OrderConfirmationDetails): string {
  const copy = getEmailCopy('orderConfirmation')
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = orderDetails
  const support = supportEmailPlain()
  const base = getAppBaseUrl()
  return t(copy.text, {
    orderNumber,
    productTitle,
    quantity,
    buyerName,
    amount: `${getCurrencySymbol(currency)}${totalAmount.toLocaleString()}`,
    ordersUrl: `${base}/my-orders`,
    helpLine: support ? `Questions? ${support}\n` : `Help: ${base}/support\n`,
  })
}
