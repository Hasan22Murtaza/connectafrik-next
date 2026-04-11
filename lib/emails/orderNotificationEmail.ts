import { getCurrencySymbol } from './currency'
import { SWIPPED, supportEmailHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

/** Seller notification — same Swipped-style coloured sections and blue CTA as shop/order emails. */
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
  const support = supportEmailHtml()
  const amountStr = `${sym}${totalAmount.toLocaleString()}`

  const supportBlock = support
    ? `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Need help? Contact us at ${support}.
    </p>`
    : ''

  return `
    <p style="font-size:20px;color:${SWIPPED.text};">Hi <b>${escapeHtml(sellerName)},</b></p>

    <p style="font-size:16px;color:${SWIPPED.text};padding-top:16px;">
      <strong>Congratulations! You have a new sale on ConnectAfrik.</strong>
    </p>

    <div style="background-color:${SWIPPED.greenBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.greenBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.greenBorder};font-size:18px;">Order information</h3>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Product:</strong> ${escapeHtml(productTitle)}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Quantity:</strong> ${quantity}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Buyer:</strong> ${escapeHtml(buyerName)}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Amount:</strong> ${amountStr}</p>
    </div>

    <div style="background-color:${SWIPPED.warnBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.warnBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.warnText};font-size:18px;">Action required</h3>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};">
        • Contact the buyer to confirm shipping details<br />
        • Prepare and pack the item<br />
        • Update the order status once shipped
      </p>
    </div>

    <div style="background-color:${SWIPPED.nextBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.nextBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.nextBorder};font-size:18px;">Suggested next steps</h3>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};">
        • Review order and shipping address<br />
        • Ship the item and add tracking if available<br />
        • Mark the order as shipped when done
      </p>
    </div>

    <p style="text-align:center;padding-top:20px;">
      <a href="${ordersUrl}" style="${SWIPPED.ctaBold}">
        View order details
      </a>
    </p>

    ${supportBlock}

    <p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Thank you for being part of ConnectAfrik!<br />
      The ConnectAfrik Team
    </p>

    <div style="margin-top:30px;padding-top:20px;border-top:1px solid ${SWIPPED.borderSubtle};font-size:12px;color:${SWIPPED.mutedFooter};">
      <p style="margin:0;">
        This is an automated message about a new order. Manage orders from your ConnectAfrik dashboard.
      </p>
    </div>
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

  const supportLine = support ? `\nNeed help? ${support}\n` : ''

  return `New order received!

Hi ${sellerName},

Congratulations! You have a new sale on ConnectAfrik.

Order information:
- Order number: ${orderNumber}
- Product: ${productTitle}
- Quantity: ${quantity}
- Buyer: ${buyerName}
- Amount: ${sym}${totalAmount.toLocaleString()}

Action required:
- Contact the buyer for shipping details
- Prepare the item
- Update order status once shipped

View orders: ${base}/my-orders
${supportLine}
Thank you for being part of ConnectAfrik!

The ConnectAfrik Team
`
}
