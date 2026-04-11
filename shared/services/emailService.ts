import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

// Initialize AWS SES Client
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  htmlBody: string
  textBody?: string
}

export type SendEmailResult = { ok: true } | { ok: false; error: string }

/**
 * Send email via AWS SES
 */
export const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
  const { to, subject, htmlBody, textBody } = options

  const recipients = Array.isArray(to) ? to : [to]

  if (!FROM_EMAIL?.trim()) {
    return { ok: false, error: 'AWS_SES_FROM_EMAIL is not set' }
  }

  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    })

    await sesClient.send(command)
    console.log(`Email sent successfully to: ${recipients.join(', ')}`)
    return { ok: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
    console.error('Error sending email:', error)
    return { ok: false, error: message }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type PostCreatedEmailVariant = 'author' | 'friend'

/** Email when a feed post is created: confirmation to author or alert to a friend. */
export const sendPostCreatedEmail = async (
  to: string,
  variant: PostCreatedEmailVariant,
  params: { authorName: string; postPreview: string; postId: string }
): Promise<boolean> => {
  const { authorName, postPreview, postId } = params
  const safeAuthor = escapeHtml(authorName)
  const safePreview = escapeHtml(postPreview)
  const base = (BASE_URL || '').replace(/\/$/, '')
  const postUrl = `${base}/post/${postId}`

  const subject =
    variant === 'author'
      ? 'Your post is live on ConnectAfrik'
      : `${authorName} shared a new post on ConnectAfrik`

  const headline =
    variant === 'author' ? 'Your post is published' : `${safeAuthor} shared a new post`

  const lead =
    variant === 'author'
      ? `<p>Hi ${safeAuthor},</p><p>Your post is now live on ConnectAfrik.</p>`
      : `<p>Hi,</p><p><strong>${safeAuthor}</strong> shared a new post you might want to see.</p>`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #FF6B35;">${headline}</h1>
    ${lead}
    <p style="background: #f9f9f9; padding: 16px; border-radius: 8px;"><strong>${safePreview}</strong></p>
    <p><a href="${postUrl}" style="display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View post</a></p>
    <p style="color: #666; font-size: 0.9em;">ConnectAfrik</p>
  </div>
</body>
</html>`

  const textLead =
    variant === 'author'
      ? `Hi ${authorName},\n\nYour post is now live on ConnectAfrik.\n\n`
      : `Hi,\n\n${authorName} shared a new post you might want to see.\n\n`

  const textBody = `${textLead}${postPreview}\n\nView: ${postUrl}\n`

  const r = await sendEmail({ to, subject, htmlBody, textBody })
  return r.ok
}

/**
 * Send order confirmation email to buyer
 */
export const sendOrderConfirmationEmail = async (
  buyerEmail: string,
  orderDetails: {
    orderNumber: string
    productTitle: string
    quantity: number
    totalAmount: number
    currency: string
    buyerName: string
  }
): Promise<boolean> => {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName } = orderDetails

  const currencySymbol = {
    USD: '$',
    GHS: '₵',
    NGN: '₦',
    KES: 'KSh',
    ZAR: 'R',
  }[currency] || currency

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .order-details { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .detail-row:last-child { border-bottom: none; }
    .total { font-size: 1.2em; font-weight: bold; color: #FF6B35; }
    .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Order Confirmed!</h1>
      <p>Thank you for your purchase on ConnectAfrik</p>
    </div>

    <div class="content">
      <p>Hi ${buyerName},</p>

      <p>Great news! Your order has been confirmed and payment received successfully.</p>

      <div class="order-details">
        <h3>Order Details</h3>
        <div class="detail-row">
          <span>Order Number:</span>
          <strong>${orderNumber}</strong>
        </div>
        <div class="detail-row">
          <span>Product:</span>
          <strong>${productTitle}</strong>
        </div>
        <div class="detail-row">
          <span>Quantity:</span>
          <strong>${quantity}</strong>
        </div>
        <div class="detail-row">
          <span>Amount Paid:</span>
          <span class="total">${currencySymbol}${totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <p><strong>What's Next?</strong></p>
      <ul>
        <li>The seller has been notified of your order</li>
        <li>You'll receive tracking information once the item ships</li>
        <li>Check your order status anytime in "My Orders"</li>
      </ul>

      <center>
        <a href="${BASE_URL}/my-orders" class="button">View My Orders</a>
      </center>

      <p>If you have any questions, feel free to message the seller through the order page.</p>

      <p>Thank you for supporting African entrepreneurs! 🌍</p>

      <p>Best regards,<br>
      <strong>The ConnectAfrik Team</strong></p>
    </div>

    <div class="footer">
      <p>This is an automated email from ConnectAfrik. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ConnectAfrik. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `

  const textBody = `
Order Confirmed!

Hi ${buyerName},

Your order has been confirmed and payment received successfully.

Order Details:
- Order Number: ${orderNumber}
- Product: ${productTitle}
- Quantity: ${quantity}
- Amount Paid: ${currencySymbol}${totalAmount.toLocaleString()}

What's Next?
- The seller has been notified of your order
- You'll receive tracking information once the item ships
- Check your order status anytime in "My Orders"

Thank you for supporting African entrepreneurs!

Best regards,
The ConnectAfrik Team
  `

  const r = await sendEmail({
    to: buyerEmail,
    subject: `Order Confirmed - ${orderNumber} - ConnectAfrik`,
    htmlBody,
    textBody,
  })
  return r.ok
}

/**
 * Send new order notification to seller
 */
export const sendNewOrderNotificationEmail = async (
  sellerEmail: string,
  orderDetails: {
    orderNumber: string
    productTitle: string
    quantity: number
    totalAmount: number
    currency: string
    buyerName: string
    sellerName: string
  }
): Promise<boolean> => {
  const { orderNumber, productTitle, quantity, totalAmount, currency, buyerName, sellerName } =
    orderDetails

  const currencySymbol = {
    USD: '$',
    GHS: '₵',
    NGN: '₦',
    KES: 'KSh',
    ZAR: 'R',
  }[currency] || currency

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .order-details { background: #f0fdf4; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #d1fae5; }
    .detail-row:last-child { border-bottom: none; }
    .total { font-size: 1.2em; font-weight: bold; color: #059669; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
    .action-required { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛍️ New Order Received!</h1>
      <p>You have a new sale on ConnectAfrik</p>
    </div>

    <div class="content">
      <p>Hi ${sellerName},</p>

      <p>Congratulations! You just made a sale! 🎉</p>

      <div class="order-details">
        <h3>Order Information</h3>
        <div class="detail-row">
          <span>Order Number:</span>
          <strong>${orderNumber}</strong>
        </div>
        <div class="detail-row">
          <span>Product:</span>
          <strong>${productTitle}</strong>
        </div>
        <div class="detail-row">
          <span>Quantity:</span>
          <strong>${quantity}</strong>
        </div>
        <div class="detail-row">
          <span>Buyer:</span>
          <strong>${buyerName}</strong>
        </div>
        <div class="detail-row">
          <span>Amount:</span>
          <span class="total">${currencySymbol}${totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <div class="action-required">
        <strong>⚠️ Action Required:</strong>
        <ul style="margin: 10px 0;">
          <li>Contact the buyer to confirm shipping details</li>
          <li>Prepare the item for shipment</li>
          <li>Update the order status once shipped</li>
        </ul>
      </div>

      <center>
        <a href="${BASE_URL}/my-orders" class="button">View Order Details</a>
      </center>

      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Review the order details and shipping address</li>
        <li>Prepare and pack the item carefully</li>
        <li>Ship the item and add tracking information</li>
        <li>Update the order status to "Shipped"</li>
      </ol>

      <p>Thank you for being part of ConnectAfrik! Keep up the great work! 💪</p>

      <p>Best regards,<br>
      <strong>The ConnectAfrik Team</strong></p>
    </div>

    <div class="footer">
      <p>This is an automated email from ConnectAfrik. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ConnectAfrik. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `

  const textBody = `
New Order Received!

Hi ${sellerName},

Congratulations! You just made a sale!

Order Information:
- Order Number: ${orderNumber}
- Product: ${productTitle}
- Quantity: ${quantity}
- Buyer: ${buyerName}
- Amount: ${currencySymbol}${totalAmount.toLocaleString()}

Action Required:
- Contact the buyer to confirm shipping details
- Prepare the item for shipment
- Update the order status once shipped

Next Steps:
1. Review the order details and shipping address
2. Prepare and pack the item carefully
3. Ship the item and add tracking information
4. Update the order status to "Shipped"

Thank you for being part of ConnectAfrik!

Best regards,
The ConnectAfrik Team
  `

  const r = await sendEmail({
    to: sellerEmail,
    subject: `🎉 New Order: ${productTitle} - ${orderNumber}`,
    htmlBody,
    textBody,
  })
  return r.ok
}

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (
  userEmail: string,
  userName: string
): Promise<boolean> => {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .feature-box { background: #f9f9f9; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #FF6B35; }
    .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to ConnectAfrik!</h1>
      <p>Join millions connecting across the African diaspora</p>
    </div>

    <div class="content">
      <p>Hi ${userName},</p>

      <p>Welcome to <strong>ConnectAfrik</strong> – the social platform designed to unite Africans and the diaspora worldwide! 🌍</p>

      <p>We're thrilled to have you join our growing community!</p>

      <h3>🚀 Get Started:</h3>

      <div class="feature-box">
        <strong>👤 Complete Your Profile</strong>
        <p>Add a profile picture, bio, and share your story with the community.</p>
      </div>

      <div class="feature-box">
        <strong>👥 Find Friends & Connect</strong>
        <p>Search for people from your country, city, or shared interests.</p>
      </div>

      <div class="feature-box">
        <strong>🛍️ Explore the Marketplace</strong>
        <p>Buy and sell authentic African products, crafts, and services.</p>
      </div>

      <div class="feature-box">
        <strong>🌟 Join Groups</strong>
        <p>Connect with communities focused on culture, activism, business, and more.</p>
      </div>

      <center>
        <a href="${BASE_URL}/feed" class="button">Explore ConnectAfrik</a>
      </center>

      <p><strong>Need Help?</strong></p>
      <p>Check out our <a href="${BASE_URL}/guidelines">Community Guidelines</a> or reach out to our <a href="${BASE_URL}/support">Support Team</a>.</p>

      <p>Let's build something amazing together! 💪</p>

      <p>Best regards,<br>
      <strong>The ConnectAfrik Team</strong></p>
    </div>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ConnectAfrik. All rights reserved.</p>
      <p>Uniting Africans and the diaspora worldwide 🌍</p>
    </div>
  </div>
</body>
</html>
  `

  const textBody = `
Welcome to ConnectAfrik!

Hi ${userName},

Welcome to ConnectAfrik – the social platform designed to unite Africans and the diaspora worldwide!

We're thrilled to have you join our growing community!

Get Started:
- Complete Your Profile: Add a profile picture, bio, and share your story
- Find Friends & Connect: Search for people from your country or city
- Explore the Marketplace: Buy and sell authentic African products
- Join Groups: Connect with communities focused on culture, activism, and more

Visit: ${BASE_URL}/feed

Need Help?
Check out our Community Guidelines or reach out to our Support Team.

Let's build something amazing together!

Best regards,
The ConnectAfrik Team
  `

  const r = await sendEmail({
    to: userEmail,
    subject: '🎉 Welcome to ConnectAfrik - Let\'s Get Started!',
    htmlBody,
    textBody,
  })
  return r.ok
}
