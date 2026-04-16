import { getCurrencySymbol } from './currency'
import { SWIPPED, emailHeadlineHtml, emailLeadHtml, supportEmailPlain } from './swippedTheme'
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
    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:${SWIPPED.textSecondary};">
      Seller support: <a href="mailto:${escapeHtml(supportPlain)}" style="color:${SWIPPED.link};">${escapeHtml(supportPlain)}</a>
    </p>`
    : ''

  return `
    ${emailHeadlineHtml(`You’ve got a new order, ${safeSeller}`)}
    ${emailLeadHtml(
      'Nice work — someone just bought from your shop. Here’s what you need at a glance.'
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${SWIPPED.borderSubtle};border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;background-color:${SWIPPED.greenBoxBg};">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${SWIPPED.greenBorder};">Sale</p>
          <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${SWIPPED.text};">${amountStr}</p>
          <p style="margin:4px 0 0;font-size:14px;color:${SWIPPED.textSecondary};">Order ${safeOrder}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:${SWIPPED.text};"><strong>Item:</strong> ${safeTitle}</p>
          <p style="margin:0 0 6px;font-size:14px;color:${SWIPPED.text};"><strong>Quantity:</strong> ${quantity}</p>
          <p style="margin:0;font-size:14px;color:${SWIPPED.text};"><strong>Buyer:</strong> ${safeBuyer}</p>
        </td>
      </tr>
    </table>

    <div style="background-color:${SWIPPED.warnBoxBg};padding:18px 20px;border-radius:10px;border-left:4px solid ${SWIPPED.warnBorder};margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${SWIPPED.warnText};">Suggested next steps</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${SWIPPED.textSecondary};">
        Confirm shipping details with your buyer if needed, pack the order carefully, and mark it as shipped when it’s on the way so they can track it.
      </p>
    </div>

    <p style="text-align:center;margin:0;">
      <a href="${ordersUrl}" style="${SWIPPED.ctaBold}">Open order in dashboard</a>
    </p>

    ${supportHtml}

    <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
      Keep selling,<br />
      <span style="color:${SWIPPED.text};font-weight:600;">The ConnectAfrik team</span>
    </p>

    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${SWIPPED.mutedFooter};text-align:center;">
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
