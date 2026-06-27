import { getCurrencySymbol } from './currency'
import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailLeadHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

export function getNewOrderNotificationEmailHtml(orderDetails: {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
  sellerName: string
}): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, sellerName } =
    orderDetails
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const ordersUrl = `${base}/my-orders`
  const amountStr = `${sym}${totalAmount.toLocaleString()}`
  const supportPlain = supportEmailPlain()
  const safeSeller = escapeHtml(sellerName)
  const safeBuyer = escapeHtml(buyerName)
  const safeOrder = escapeHtml(orderNumber)
  const safeTitle = escapeHtml(productTitle)

  const supportHtml = supportPlain
    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:${EMAIL_THEME.text};text-align:center;">
        Seller support: <a href="mailto:${escapeHtml(supportPlain)}" style="color:${EMAIL_THEME.link};">${escapeHtml(supportPlain)}</a>
      </p>`
    : ''

  return `
    ${emailHeadlineHtml(`You’ve got a new order, ${safeSeller}`)}
    ${emailLeadHtml('Nice work — someone just bought from your shop. Here’s what you need at a glance.')}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${EMAIL_THEME.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;background-color:${EMAIL_THEME.successBg};border-bottom:1px solid ${EMAIL_THEME.border};">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${EMAIL_THEME.successAccent};">Sale</p>
          <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${EMAIL_THEME.heading};">${amountStr}</p>
          <p style="margin:4px 0 0;font-size:14px;color:${EMAIL_THEME.text};">Order ${safeOrder}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.heading};"><strong>Item:</strong> ${safeTitle}</p>
          <p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.heading};"><strong>Quantity:</strong> ${quantity}</p>
          <p style="margin:0;font-size:14px;color:${EMAIL_THEME.heading};"><strong>Buyer:</strong> ${safeBuyer}</p>
        </td>
      </tr>
    </table>

    ${emailAccentBoxHtml({
      variant: 'warn',
      eyebrow: 'Suggested next steps',
      bodyHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:${EMAIL_THEME.text};">
        Confirm shipping details with your buyer if needed, pack the order carefully, and mark it as shipped when it’s on the way so they can track it.
      </p>`,
    })}

    ${emailButtonHtml(ordersUrl, 'Open order in dashboard')}

    ${supportHtml}

    ${emailSignOffHtml('Keep selling,')}

    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${EMAIL_THEME.textMuted};text-align:center;">
      This is an automated message about activity on your seller account.
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
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, sellerName } =
    orderDetails
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const supportLine = support ? `\nSeller support: ${support}\n` : ''

  return `New order — ${orderNumber}

Hi ${sellerName},

You have a new sale on ConnectAfrik.

${productTitle} × ${quantity}
Buyer: ${buyerName}
Total: ${sym}${totalAmount.toLocaleString()}

Next steps: confirm details if needed, ship the order, and update the status in your dashboard.

View order: ${base}/my-orders
${supportLine}
— The ConnectAfrik team
`
}
