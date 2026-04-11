import { getCurrencySymbol } from './currency'
import { SWIPPED, supportEmailHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

type OrderConfirmationDetails = {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
}

/** Same narrative as the plain-text email — used for `text/plain` and mirrored in HTML. */
function getOrderConfirmationNarrativeText(d: OrderConfirmationDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = d
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const supportLine = support
    ? `Questions? Contact us at ${support}.\n`
    : `Questions? View your orders on ConnectAfrik.\n`

  return `Order confirmed!

Thank you ${buyerName}!

Great news! Your order has been confirmed and payment has been processed successfully.

Order details:
- Order number: ${orderNumber}
- Product: ${productTitle}
- Quantity: ${quantity}

Payment:
- Amount paid: ${sym}${totalAmount.toLocaleString()}
- Status: Payment successful

What happens next:
- The seller has been notified
- You will receive tracking when the item ships
- Check status in My Orders

View orders: ${base}/my-orders

${supportLine}Thank you for supporting African entrepreneurs!

The ConnectAfrik Team
`
}

/** HTML block mirroring `getOrderConfirmationNarrativeText` (included in the same HTML email). */
function getOrderConfirmationNarrativeHtml(d: OrderConfirmationDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = d
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const ordersUrl = `${base}/my-orders`
  const support = supportEmailPlain()
  const supportLineHtml = support
    ? `Questions? Contact us at ${escapeHtml(support)}.`
    : `Questions? View your orders on ConnectAfrik.`

  const safeName = escapeHtml(buyerName)
  const safeOrder = escapeHtml(orderNumber)
  const safeTitle = escapeHtml(productTitle)
  const amountStr = `${sym}${totalAmount.toLocaleString()}`

  return `
    <div style="margin-top:28px;padding:20px;background-color:#f8f9fa;border-radius:8px;border:1px solid ${SWIPPED.borderSubtle};">
      <p style="margin:0 0 12px;font-size:12px;color:${SWIPPED.mutedFooter};text-transform:uppercase;letter-spacing:0.04em;">Message summary</p>
      <p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:${SWIPPED.text};">Order confirmed!</p>
      <p style="margin:0 0 16px;font-size:14px;color:${SWIPPED.text};">Thank you ${safeName}!</p>
      <p style="margin:0 0 16px;font-size:14px;color:${SWIPPED.text};">
        Great news! Your order has been confirmed and payment has been processed successfully.
      </p>
      <p style="margin:0 0 6px;font-size:14px;color:${SWIPPED.text};"><strong>Order details:</strong></p>
      <p style="margin:0;font-size:14px;color:${SWIPPED.text};line-height:1.7;">
        – Order number: ${safeOrder}<br />
        – Product: ${safeTitle}<br />
        – Quantity: ${quantity}
      </p>
      <p style="margin:16px 0 6px;font-size:14px;color:${SWIPPED.text};"><strong>Payment:</strong></p>
      <p style="margin:0;font-size:14px;color:${SWIPPED.text};line-height:1.7;">
        – Amount paid: ${amountStr}<br />
        – Status: Payment successful
      </p>
      <p style="margin:16px 0 6px;font-size:14px;color:${SWIPPED.text};"><strong>What happens next:</strong></p>
      <p style="margin:0;font-size:14px;color:${SWIPPED.text};line-height:1.7;">
        – The seller has been notified<br />
        – You will receive tracking when the item ships<br />
        – Check status in My Orders
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:${SWIPPED.text};">
        View orders: <a href="${ordersUrl}" style="color:${SWIPPED.ctaBg};word-break:break-all;">${ordersUrl}</a>
      </p>
      <p style="margin:12px 0 0;font-size:14px;color:${SWIPPED.text};">${supportLineHtml}</p>
      <p style="margin:16px 0 0;font-size:14px;color:${SWIPPED.text};">Thank you for supporting African entrepreneurs!</p>
      <p style="margin:8px 0 0;font-size:14px;color:${SWIPPED.text};">The ConnectAfrik Team</p>
    </div>
  `
}

/** Buyer confirmation — section blocks match Swipped `shopOrderPaymentEmail.js`. */
export function getOrderConfirmationEmailHtml(orderDetails: OrderConfirmationDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = orderDetails
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const ordersUrl = `${base}/my-orders`
  const support = supportEmailHtml()
  const safeOrder = escapeHtml(orderNumber)
  const safeTitle = escapeHtml(productTitle)
  const safeName = escapeHtml(buyerName)
  const amountStr = `${sym}${totalAmount.toLocaleString()}`

  const supportBlock = support
    ? `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Questions about your order? Reply to this email or contact us at ${support}.
    </p>`
    : `<p style="font-size:14px;color:${SWIPPED.text};padding-top:16px;">
      Questions about your order? Visit your orders page on ConnectAfrik.
    </p>`

  const narrativeMirror = getOrderConfirmationNarrativeHtml(orderDetails)

  return `
    <p style="font-size:20px;color:${SWIPPED.text};">Thank you ${safeName}!</p>

    <p style="font-size:16px;color:${SWIPPED.text};padding-top:16px;">
      <strong>Great news! Your order has been confirmed and payment has been processed successfully.</strong>
    </p>

    <div style="background-color:${SWIPPED.greenBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.greenBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.greenBorder};font-size:18px;">Order details</h3>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Order number:</strong> ${safeOrder}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Product:</strong> ${safeTitle}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Quantity:</strong> ${quantity}</p>
    </div>

    <div style="background-color:${SWIPPED.blueBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.blueBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.blueBorder};font-size:18px;">Item</h3>
      <p style="margin:0;font-size:14px;color:${SWIPPED.text};font-weight:bold;">${safeTitle}</p>
      <p style="margin:5px 0 0;font-size:12px;color:${SWIPPED.mutedFooter};">Quantity: ${quantity}</p>
    </div>

    <div style="background-color:${SWIPPED.paymentBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.greenBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.greenBorder};font-size:18px;">Payment confirmation</h3>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Amount paid:</strong> ${amountStr}</p>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};"><strong>Status:</strong> Payment successful</p>
    </div>

    <div style="background-color:${SWIPPED.nextBoxBg};padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid ${SWIPPED.nextBorder};">
      <h3 style="margin:0 0 15px 0;color:${SWIPPED.nextBorder};font-size:18px;">What happens next?</h3>
      <p style="margin:5px 0;font-size:14px;color:${SWIPPED.text};">
        • <strong>Order processing</strong> – The seller has been notified<br />
        • <strong>Shipping</strong> – You will receive tracking information once the item ships<br />
        • <strong>My orders</strong> – Check your order status anytime in My Orders
      </p>
    </div>

    <p style="text-align:center;padding-top:20px;">
      <a href="${ordersUrl}" style="${SWIPPED.ctaBold}">
        View my orders
      </a>
    </p>

    <div style="background-color:${SWIPPED.warnBoxBg};padding:15px;border-radius:6px;margin:20px 0;border-left:4px solid ${SWIPPED.warnBorder};">
      <p style="margin:0;font-size:14px;color:${SWIPPED.warnText};">
        <strong>Important:</strong> Keep this email for your records. You can view order status on ConnectAfrik.
      </p>
    </div>

    ${supportBlock}

    ${narrativeMirror}

    <div style="margin-top:30px;padding-top:20px;border-top:1px solid ${SWIPPED.borderSubtle};font-size:12px;color:${SWIPPED.mutedFooter};">
      <p style="margin:0;">
        This email confirms that order ${safeOrder} has been placed and payment processed. You can view this order in your account.
      </p>
    </div>
  `
}

export function getOrderConfirmationEmailText(orderDetails: OrderConfirmationDetails): string {
  return getOrderConfirmationNarrativeText(orderDetails)
}
