import { getCurrencySymbol } from './currency'
import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailBoxBodyHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailLeadHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { getEmailCopy, getLabels, t } from './content'

export function getNewOrderNotificationEmailHtml(orderDetails: {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
  sellerName: string
}): string {
  const copy = getEmailCopy('orderReceived')
  const labels = getLabels()
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, sellerName } =
    orderDetails
  const vars = { orderNumber, productTitle, quantity, buyerName, sellerName }
  const amountStr = `${getCurrencySymbol(currency)}${totalAmount.toLocaleString()}`
  const ordersUrl = `${getAppBaseUrl()}/my-orders`
  const supportPlain = supportEmailPlain()

  const supportHtml = supportPlain
    ? `<p style="margin:16px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:13px;line-height:1.55;color:${EMAIL_THEME.textMuted};text-align:center;">
        <a href="mailto:${supportPlain}" style="color:${EMAIL_THEME.link};text-decoration:underline;">${supportPlain}</a>
      </p>`
    : ''

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${EMAIL_THEME.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;background-color:${EMAIL_THEME.successBg};border-bottom:1px solid ${EMAIL_THEME.border};">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${EMAIL_THEME.successAccent};">${t(copy.saleLabel)}</p>
          <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${EMAIL_THEME.heading};">${amountStr}</p>
          <p style="margin:4px 0 0;font-size:14px;color:${EMAIL_THEME.text};">${labels.order} ${t('{{orderNumber}}', vars, true)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.heading};"><strong>${t(copy.itemLabel)}:</strong> ${t('{{productTitle}}', vars, true)}</p>
          <p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.heading};"><strong>${t(copy.quantityField)}:</strong> ${quantity}</p>
          <p style="margin:0;font-size:14px;color:${EMAIL_THEME.heading};"><strong>${t(copy.buyerField)}:</strong> ${t('{{buyerName}}', vars, true)}</p>
        </td>
      </tr>
    </table>

    ${emailAccentBoxHtml({
      variant: 'warn',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}

    ${emailButtonHtml(ordersUrl, t(copy.buttonLabel))}
    ${supportHtml}
    ${emailSignOffHtml(t(copy.signOff))}
    <p style="margin:16px 0 0;font-family:${EMAIL_THEME.fontSans};font-size:12px;line-height:1.5;color:${EMAIL_THEME.textMuted};text-align:center;">
      ${t(copy.automatedSellerNote)}
    </p>
  `
}

export function getNewOrderNotificationEmailText(orderDetails: {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
  sellerName: string
}): string {
  const copy = getEmailCopy('orderReceived')
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, sellerName } =
    orderDetails
  const support = supportEmailPlain()
  return t(copy.text, {
    orderNumber,
    productTitle,
    quantity,
    buyerName,
    sellerName,
    amount: `${getCurrencySymbol(currency)}${totalAmount.toLocaleString()}`,
    ordersUrl: `${getAppBaseUrl()}/my-orders`,
    supportLine: support ? `\nSeller support: ${support}\n` : '',
  })
}
