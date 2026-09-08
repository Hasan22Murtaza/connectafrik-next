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
  getOrderStatusChangeEmailHtml,
  getOrderStatusChangeEmailMeta,
  getOrderStatusChangeEmailSubject,
  getOrderStatusChangeEmailText,
  type OrderStatusChangeDetails,
} from '@/lib/emails/orderStatusChangeEmail'
import {
  getPostCreatedEmailHtml,
  getPostCreatedEmailText,
  type PostCreatedEmailVariant,
} from '@/lib/emails/postCreatedEmail'
import { getWelcomeEmailHtml, getWelcomeEmailText } from '@/lib/emails/welcomeEmail'
import {
  getGroupInviteEmailHtml,
  getGroupInviteEmailText,
} from '@/lib/emails/groupInviteEmail'
import {
  getSignupConfirmationEmailHtml,
  getSignupConfirmationEmailText,
} from '@/lib/emails/signupConfirmationEmail'
import { getOtpEmailHtml, getOtpEmailText } from '@/lib/emails/otpEmail'
import {
  getPasswordChangedEmailHtml,
  getPasswordChangedEmailText,
} from '@/lib/emails/passwordChangedEmail'
import {
  getNewLoginAlertEmailHtml,
  getNewLoginAlertEmailText,
  type NewLoginAlertDetails,
} from '@/lib/emails/newLoginAlertEmail'
import {
  getFriendRequestAcceptedEmailHtml,
  getFriendRequestAcceptedEmailText,
  getFriendRequestReceivedEmailHtml,
  getFriendRequestReceivedEmailText,
  type FriendRequestEmailDetails,
} from '@/lib/emails/friendRequestEmail'
import {
  getGroupJoinRequestEmailHtml,
  getGroupJoinRequestEmailText,
  getGroupRequestApprovedEmailHtml,
  getGroupRequestApprovedEmailText,
  getGroupRequestRejectedEmailHtml,
  getGroupRequestRejectedEmailText,
  type GroupJoinEmailDetails,
} from '@/lib/emails/groupMembershipEmail'
import {
  getReportReceivedEmailHtml,
  getReportReceivedEmailText,
  type ReportReceivedDetails,
} from '@/lib/emails/reportReceivedEmail'
import {
  getAccountReactivatedEmailHtml,
  getAccountReactivatedEmailText,
  getAccountSuspendedEmailHtml,
  getAccountSuspendedEmailText,
} from '@/lib/emails/accountModerationEmail'
import {
  getPaymentEmailCopy,
  getPaymentEmailHtml,
  getPaymentEmailText,
  type PaymentEmailDetails,
  type PaymentStatus,
} from '@/lib/emails/paymentStatusEmail'
import {
  getOrderRefundCompletedEmailHtml,
  getOrderRefundCompletedEmailText,
  getOrderRefundInitiatedEmailHtml,
  getOrderRefundInitiatedEmailText,
  type OrderRefundEmailDetails,
} from '@/lib/emails/orderRefundEmail'
import {
  getSellerPayoutEmailHtml,
  getSellerPayoutEmailText,
  getSellerPayoutFailedEmailHtml,
  getSellerPayoutFailedEmailText,
  type SellerPayoutEmailDetails,
} from '@/lib/emails/sellerPayoutEmail'
import {
  getNewReviewReceivedEmailHtml,
  getNewReviewReceivedEmailText,
  getOrderReviewRequestEmailHtml,
  getOrderReviewRequestEmailText,
  type NewReviewEmailDetails,
  type OrderReviewRequestDetails,
} from '@/lib/emails/reviewEmail'
import {
  getPlatformAnnouncementEmailHtml,
  getPlatformAnnouncementEmailText,
  type PlatformAnnouncementDetails,
} from '@/lib/emails/announcementEmail'
import { getEmailCopy, getEmailMeta, t } from '@/lib/emails/content'
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

/** Wrap inner HTML with brand shell (navy wordmark, card, footer) and optional inbox preheader. */
export function renderBrandEmailHtml(
  subject: string,
  innerContentHtml: string,
  options?: { preheader?: string; headerTitle?: string; headerSubtitle?: string; badge?: string }
): string {
  return EmailTemplate({
    content: innerContentHtml,
    subject,
    preheader: options?.preheader,
    headerTitle: options?.headerTitle,
    headerSubtitle: options?.headerSubtitle,
    badge: options?.badge,
  })
}

async function sendBrandedEmail(
  to: string | string[],
  subject: string,
  innerHtml: string,
  textBody: string,
  meta: { preheader: string; headerTitle: string; headerSubtitle: string; badge?: string }
): Promise<boolean> {
  const htmlBody = renderBrandEmailHtml(subject, innerHtml, meta)
  const r = await sendEmail({ to, subject, htmlBody, textBody })
  return r.ok
}

/** Email when a feed post is created: confirmation to author or alert to a friend. */
export const sendPostCreatedEmail = async (
  to: string,
  variant: PostCreatedEmailVariant,
  params: { authorName: string; postPreview: string; postId: string }
): Promise<boolean> => {
  const { authorName, postPreview, postId } = params
  const meta = getEmailMeta(`postCreated.${variant}`, { authorName })
  const innerHtml = getPostCreatedEmailHtml({ variant, authorName, postPreview, postId })
  const htmlBody = renderBrandEmailHtml(meta.subject, innerHtml, meta)
  const textBody = getPostCreatedEmailText({ variant, authorName, postPreview, postId })

  const r = await sendEmail({ to, subject: meta.subject, htmlBody, textBody })
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
  const meta = getEmailMeta('orderConfirmation', orderDetails)
  const innerHtml = getOrderConfirmationEmailHtml(orderDetails)
  const htmlBody = renderBrandEmailHtml(meta.subject, innerHtml, meta)
  const textBody = getOrderConfirmationEmailText(orderDetails)

  const r = await sendEmail({
    to: buyerEmail,
    subject: meta.subject,
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
  const meta = getEmailMeta('orderReceived', orderDetails)
  const innerHtml = getNewOrderNotificationEmailHtml(orderDetails)
  const htmlBody = renderBrandEmailHtml(meta.subject, innerHtml, meta)
  const textBody = getNewOrderNotificationEmailText(orderDetails)

  const r = await sendEmail({
    to: sellerEmail,
    subject: meta.subject,
    htmlBody,
    textBody,
  })
  return r.ok
}

/**
 * Notify the buyer when their order status changes.
 */
export const sendOrderStatusChangeEmail = async (
  buyerEmail: string,
  orderDetails: OrderStatusChangeDetails
): Promise<boolean> => {
  const subject = getOrderStatusChangeEmailSubject(orderDetails)
  const meta = getOrderStatusChangeEmailMeta(orderDetails)
  const innerHtml = getOrderStatusChangeEmailHtml(orderDetails)
  const htmlBody = renderBrandEmailHtml(subject, innerHtml, {
    preheader: meta.preheader,
    headerTitle: meta.headerTitle,
    headerSubtitle: meta.headerSubtitle,
    badge: meta.badge,
  })
  const textBody = getOrderStatusChangeEmailText(orderDetails)

  const r = await sendEmail({
    to: buyerEmail,
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
  const subject = t(getEmailCopy(`otp.${purpose}`).subject)
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
  const subject = t(getEmailCopy('verifyEmail').subject)
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
 * Send a group invitation email to a user.
 */
export const sendGroupInviteEmail = async (
  to: string,
  params: {
    groupName: string
    inviterName: string
    groupImageUrl?: string | null
    invitationMessage?: string | null
    groupId: string
  }
): Promise<boolean> => {
  const meta = getEmailMeta('groupInvite', params)
  const innerHtml = getGroupInviteEmailHtml(params)
  const htmlBody = renderBrandEmailHtml(meta.subject, innerHtml, meta)
  const textBody = getGroupInviteEmailText(params)

  const r = await sendEmail({ to, subject: meta.subject, htmlBody, textBody })
  return r.ok
}

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (userEmail: string, userName: string): Promise<boolean> => {
  const meta = getEmailMeta('welcome', { userName })
  const innerHtml = getWelcomeEmailHtml(userName)
  const htmlBody = renderBrandEmailHtml(meta.subject, innerHtml, meta)
  const textBody = getWelcomeEmailText(userName)

  const r = await sendEmail({
    to: userEmail,
    subject: meta.subject,
    htmlBody,
    textBody,
  })
  return r.ok
}

export const sendPasswordChangedEmail = async (
  userEmail: string,
  userName: string
): Promise<boolean> => {
  const meta = getEmailMeta('passwordChanged', { userName })
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getPasswordChangedEmailHtml(userName),
    getPasswordChangedEmailText(userName),
    meta
  )
}

export const sendNewLoginAlertEmail = async (
  userEmail: string,
  details: NewLoginAlertDetails
): Promise<boolean> => {
  const meta = getEmailMeta('newLoginAlert', details)
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getNewLoginAlertEmailHtml(details),
    getNewLoginAlertEmailText(details),
    meta
  )
}

export const sendFriendRequestReceivedEmail = async (
  userEmail: string,
  details: FriendRequestEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('friendRequestReceived', details)
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getFriendRequestReceivedEmailHtml(details),
    getFriendRequestReceivedEmailText(details),
    meta
  )
}

export const sendFriendRequestAcceptedEmail = async (
  userEmail: string,
  details: FriendRequestEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('friendRequestAccepted', details)
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getFriendRequestAcceptedEmailHtml(details),
    getFriendRequestAcceptedEmailText(details),
    meta
  )
}

export const sendGroupJoinRequestEmail = async (
  userEmail: string,
  details: GroupJoinEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('groupJoinRequest', details)
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getGroupJoinRequestEmailHtml(details),
    getGroupJoinRequestEmailText(details),
    meta
  )
}

export const sendGroupRequestApprovedEmail = async (
  userEmail: string,
  details: GroupJoinEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('groupRequestApproved', details)
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getGroupRequestApprovedEmailHtml(details),
    getGroupRequestApprovedEmailText(details),
    meta
  )
}

export const sendGroupRequestRejectedEmail = async (
  userEmail: string,
  details: GroupJoinEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('groupRequestRejected', details)
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getGroupRequestRejectedEmailHtml(details),
    getGroupRequestRejectedEmailText(details),
    meta
  )
}

export const sendReportReceivedEmail = async (
  adminEmail: string,
  details: ReportReceivedDetails
): Promise<boolean> => {
  const meta = getEmailMeta('reportReceived', details)
  return sendBrandedEmail(
    adminEmail,
    meta.subject,
    getReportReceivedEmailHtml(details),
    getReportReceivedEmailText(details),
    meta
  )
}

export const sendAccountSuspendedEmail = async (
  userEmail: string,
  userName: string,
  reason?: string | null
): Promise<boolean> => {
  const meta = getEmailMeta('accountSuspended', { userName })
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getAccountSuspendedEmailHtml(userName, reason),
    getAccountSuspendedEmailText(userName, reason),
    meta
  )
}

export const sendAccountReactivatedEmail = async (
  userEmail: string,
  userName: string
): Promise<boolean> => {
  const meta = getEmailMeta('accountReactivated', { userName })
  return sendBrandedEmail(
    userEmail,
    meta.subject,
    getAccountReactivatedEmailHtml(userName),
    getAccountReactivatedEmailText(userName),
    meta
  )
}

export const sendPaymentStatusEmail = async (
  buyerEmail: string,
  status: PaymentStatus,
  details: PaymentEmailDetails
): Promise<boolean> => {
  const copy = getPaymentEmailCopy(status, details)
  return sendBrandedEmail(
    buyerEmail,
    copy.subject,
    getPaymentEmailHtml(status, details),
    getPaymentEmailText(status, details),
    {
      preheader: copy.preheader,
      headerTitle: copy.headerTitle,
      headerSubtitle: copy.headerSubtitle,
      badge: copy.badge,
    }
  )
}

export const sendOrderRefundInitiatedEmail = async (
  buyerEmail: string,
  details: OrderRefundEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('refundInitiated', details)
  return sendBrandedEmail(
    buyerEmail,
    meta.subject,
    getOrderRefundInitiatedEmailHtml(details),
    getOrderRefundInitiatedEmailText(details),
    meta
  )
}

export const sendOrderRefundCompletedEmail = async (
  buyerEmail: string,
  details: OrderRefundEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('refundCompleted', details)
  return sendBrandedEmail(
    buyerEmail,
    meta.subject,
    getOrderRefundCompletedEmailHtml(details),
    getOrderRefundCompletedEmailText(details),
    meta
  )
}

export const sendSellerPayoutEmail = async (
  sellerEmail: string,
  details: SellerPayoutEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('sellerPayout', details)
  return sendBrandedEmail(
    sellerEmail,
    meta.subject,
    getSellerPayoutEmailHtml(details),
    getSellerPayoutEmailText(details),
    meta
  )
}

export const sendSellerPayoutFailedEmail = async (
  sellerEmail: string,
  details: SellerPayoutEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('sellerPayoutFailed', details)
  return sendBrandedEmail(
    sellerEmail,
    meta.subject,
    getSellerPayoutFailedEmailHtml(details),
    getSellerPayoutFailedEmailText(details),
    meta
  )
}

export const sendNewReviewReceivedEmail = async (
  sellerEmail: string,
  details: NewReviewEmailDetails
): Promise<boolean> => {
  const meta = getEmailMeta('newReviewReceived', details)
  return sendBrandedEmail(
    sellerEmail,
    meta.subject,
    getNewReviewReceivedEmailHtml(details),
    getNewReviewReceivedEmailText(details),
    meta
  )
}

export const sendOrderReviewRequestEmail = async (
  buyerEmail: string,
  details: OrderReviewRequestDetails
): Promise<boolean> => {
  const meta = getEmailMeta('orderReviewRequest', details)
  return sendBrandedEmail(
    buyerEmail,
    meta.subject,
    getOrderReviewRequestEmailHtml(details),
    getOrderReviewRequestEmailText(details),
    meta
  )
}

export const sendPlatformAnnouncementEmail = async (
  to: string | string[],
  details: PlatformAnnouncementDetails
): Promise<boolean> => {
  const meta = getEmailMeta('announcement', {
    recipientName: details.recipientName,
    title: details.title,
  })
  return sendBrandedEmail(
    to,
    details.title,
    getPlatformAnnouncementEmailHtml(details),
    getPlatformAnnouncementEmailText(details),
    {
      ...meta,
      preheader: details.body.replace(/\s+/g, ' ').trim().slice(0, 140),
    }
  )
}
