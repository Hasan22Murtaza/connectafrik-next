import { EmailTemplate } from '@/lib/emails/EmailTemplate'
import {
  getNewOrderNotificationEmailHtml,
  getNewOrderNotificationEmailText,
} from '@/lib/emails/orderNotificationEmail'
import {
  getOrderConfirmationEmailHtml,
  getOrderConfirmationEmailText,
} from '@/lib/emails/orderConfirmationEmail'
import {
  getPostCreatedEmailHtml,
  getPostCreatedEmailText,
  type PostCreatedEmailVariant,
} from '@/lib/emails/postCreatedEmail'
import { getWelcomeEmailHtml, getWelcomeEmailText } from '@/lib/emails/welcomeEmail'
import {
  getSignupConfirmationEmailHtml,
  getSignupConfirmationEmailText,
} from '@/lib/emails/signupConfirmationEmail'
import { getOtpEmailHtml, getOtpEmailText } from '@/lib/emails/otpEmail'
import type { OtpPurpose } from '@/lib/auth/otpTypes'
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

export type { PostCreatedEmailVariant }

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  htmlBody: string
  textBody?: string
}

export type SendEmailResult = { ok: true } | { ok: false; error: string }

/**
 * Send email via AWS SES (raw HTML — use for tests or custom bodies without the brand shell).
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

/** Wrap inner HTML with brand shell (gradient banner header, card, footer) and optional inbox preheader. */
export function renderBrandEmailHtml(
  subject: string,
  innerContentHtml: string,
  options?: { preheader?: string; headerTitle?: string; headerSubtitle?: string }
): string {
  return EmailTemplate({
    content: innerContentHtml,
    subject,
    preheader: options?.preheader,
    headerTitle: options?.headerTitle,
    headerSubtitle: options?.headerSubtitle,
  })
}

/** Email when a feed post is created: confirmation to author or alert to a friend. */
export const sendPostCreatedEmail = async (
  to: string,
  variant: PostCreatedEmailVariant,
  params: { authorName: string; postPreview: string; postId: string }
): Promise<boolean> => {
  const { authorName, postPreview, postId } = params

  const subject =
    variant === 'author'
      ? 'Your post is live'
      : `${authorName} shared a new post`

  const preheader =
    variant === 'author'
      ? 'Tap to view your post and share it with your network.'
      : `See what ${authorName} posted on ConnectAfrik.`

  const headerTitle = variant === 'author' ? 'Your post is live!' : 'New on ConnectAfrik'
  const headerSubtitle =
    variant === 'author'
      ? 'Your update is now in the feed'
      : `${authorName} just shared something new`

  const innerHtml = getPostCreatedEmailHtml({ variant, authorName, postPreview, postId })
  const htmlBody = renderBrandEmailHtml(subject, innerHtml, { preheader, headerTitle, headerSubtitle })
  const textBody = getPostCreatedEmailText({ variant, authorName, postPreview, postId })

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
  const subject = `Payment received · Order ${orderDetails.orderNumber}`
  const innerHtml = getOrderConfirmationEmailHtml(orderDetails)
  const htmlBody = renderBrandEmailHtml(subject, innerHtml, {
    preheader: `We’ve got your order ${orderDetails.orderNumber}. The seller has been notified.`,
    headerTitle: 'Payment Received!',
    headerSubtitle: 'Thank you for your purchase',
  })
  const textBody = getOrderConfirmationEmailText(orderDetails)

  const r = await sendEmail({
    to: buyerEmail,
    subject,
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
  const subject = `New sale · Order ${orderDetails.orderNumber}`
  const innerHtml = getNewOrderNotificationEmailHtml(orderDetails)
  const htmlBody = renderBrandEmailHtml(subject, innerHtml, {
    preheader: `${orderDetails.buyerName} purchased ${orderDetails.productTitle}. Open your dashboard to fulfill it.`,
    headerTitle: 'You Made a Sale!',
    headerSubtitle: 'A new order is waiting for you',
  })
  const textBody = getNewOrderNotificationEmailText(orderDetails)

  const r = await sendEmail({
    to: sellerEmail,
    subject,
    htmlBody,
    textBody,
  })
  return r.ok
}

/**
 * Send a 6-digit OTP email for signup, login verification, or password recovery.
 */
export const sendOtpEmail = async (
  userEmail: string,
  code: string,
  purpose: OtpPurpose
): Promise<boolean> => {
  const purposeCopy: Record<OtpPurpose, string> = {
    signup: 'Your ConnectAfrik verification code',
    login: 'Your ConnectAfrik sign-in code',
    recovery: 'Your ConnectAfrik password reset code',
  }

  const subject = purposeCopy[purpose]
  const htmlBody = getOtpEmailHtml(code, purpose)
  const textBody = getOtpEmailText(code, purpose)

  const r = await sendEmail({
    to: userEmail,
    subject,
    htmlBody,
    textBody,
  })
  return r.ok
}

/**
 * Send signup confirmation email (custom template via SES, not Supabase).
 */
export const sendSignupConfirmationEmail = async (
  userEmail: string,
  confirmationUrl: string
): Promise<boolean> => {
  const subject = 'Confirm your ConnectAfrik account'
  const htmlBody = getSignupConfirmationEmailHtml(confirmationUrl)
  const textBody = getSignupConfirmationEmailText(confirmationUrl)

  const r = await sendEmail({
    to: userEmail,
    subject,
    htmlBody,
    textBody,
  })
  return r.ok
}

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (userEmail: string, userName: string): Promise<boolean> => {
  const subject = 'Welcome to ConnectAfrik'
  const innerHtml = getWelcomeEmailHtml(userName)
  const htmlBody = renderBrandEmailHtml(subject, innerHtml, {
    preheader: 'Your account is ready. Open the app to finish your profile and explore the feed.',
    headerTitle: 'Welcome to ConnectAfrik!',
    headerSubtitle: 'Your journey with the African diaspora starts here',
  })
  const textBody = getWelcomeEmailText(userName)

  const r = await sendEmail({
    to: userEmail,
    subject,
    htmlBody,
    textBody,
  })
  return r.ok
}
