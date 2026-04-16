import { getCurrencySymbol } from './currency'
import { SWIPPED, emailHeadlineHtml, emailLeadHtml, supportEmailPlain } from './swippedTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

type OrderConfirmationDetails = {
  orderNumber: string
  productTitle: string
  quantity: number
  totalAmount: number
  currency: string
  buyerName: string
}

function getOrderConfirmationNarrativeText(d: OrderConfirmationDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = d
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const supportLine = support ? `Questions? ${support}\n` : `Help: ${base}/support\n`

  return `Payment received — order ${orderNumber}

Hi ${buyerName},

Thanks for your purchase. We’ve received your payment and shared the details with the seller.

What you ordered
• ${productTitle} × ${quantity}

Paid
• ${sym}${totalAmount.toLocaleString()} — successful

What happens next
• The seller prepares your order
• You’ll get tracking or updates when it ships
• Track everything in My Orders: ${base}/my-orders

${supportLine}Thank you for supporting sellers on ConnectAfrik.

— The ConnectAfrik team
`
}

export function getOrderConfirmationEmailHtml(orderDetails: OrderConfirmationDetails): string {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = orderDetails
  const sym = getCurrencySymbol(currency)
  const base = getAppBaseUrl()
  const ordersUrl = `${base}/my-orders`
  const supportPlain = supportEmailPlain()
  const safeOrder = escapeHtml(orderNumber)
  const safeTitle = escapeHtml(productTitle)
  const safeName = escapeHtml(buyerName)
  const amountStr = `${sym}${totalAmount.toLocaleString()}`

  const supportHtml = supportPlain
    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:${SWIPPED.textSecondary};">
      Need help with this order? Reply to this message or email
      <a href="mailto:${escapeHtml(supportPlain)}" style="color:${SWIPPED.link};">${escapeHtml(supportPlain)}</a>.
    </p>`
    : `<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:${SWIPPED.textSecondary};">
      Questions? Visit your <a href="${ordersUrl}" style="color:${SWIPPED.link};">orders</a> page or our <a href="${base}/support" style="color:${SWIPPED.link};">help center</a>.
    </p>`

  return `
    ${emailHeadlineHtml(`Thanks, ${safeName} — you’re all set`)}
    ${emailLeadHtml(
      `We’ve received your payment for order <strong style="color:${SWIPPED.text};">${safeOrder}</strong>. The seller has been notified and will work on fulfilling it.`
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${SWIPPED.borderSubtle};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;background-color:${SWIPPED.greenBoxBg};border-bottom:1px solid ${SWIPPED.borderSubtle};">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${SWIPPED.greenBorder};">Order summary</p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:${SWIPPED.text};">${safeTitle}</p>
          <p style="margin:4px 0 0;font-size:14px;color:${SWIPPED.textSecondary};">Quantity: ${quantity}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:${SWIPPED.textSecondary};">Order number</td>
              <td align="right" style="font-size:14px;font-weight:600;color:${SWIPPED.text};">${safeOrder}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:12px 0;border-bottom:1px solid ${SWIPPED.borderSubtle};"></td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:14px;color:${SWIPPED.textSecondary};">Amount paid</td>
              <td align="right" style="padding-top:12px;font-size:16px;font-weight:700;color:${SWIPPED.text};">${amountStr}</td>
            </tr>
            <tr>
              <td style="padding-top:6px;font-size:14px;color:${SWIPPED.textSecondary};">Status</td>
              <td align="right" style="padding-top:6px;font-size:14px;font-weight:600;color:${SWIPPED.greenBorder};">Paid</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="background-color:${SWIPPED.nextBoxBg};padding:18px 20px;border-radius:10px;border-left:4px solid ${SWIPPED.nextBorder};margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${SWIPPED.text};">What happens next</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${SWIPPED.textSecondary};">
        The seller will prepare your package. When it ships, you’ll see updates here — and you can always check status in <strong style="color:${SWIPPED.text};">My orders</strong>.
      </p>
    </div>

    <p style="text-align:center;margin:0 0 8px;">
      <a href="${ordersUrl}" style="${SWIPPED.ctaBold}">View order details</a>
    </p>
    <p style="text-align:center;margin:0;font-size:13px;color:${SWIPPED.mutedFooter};">
      Save this email for your records.
    </p>

    ${supportHtml}

    <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${SWIPPED.textSecondary};">
      With gratitude,<br />
      <span style="color:${SWIPPED.text};font-weight:600;">The ConnectAfrik team</span>
    </p>
  `
}

export function getOrderConfirmationEmailText(orderDetails: OrderConfirmationDetails): string {
  return getOrderConfirmationNarrativeText(orderDetails)
}
