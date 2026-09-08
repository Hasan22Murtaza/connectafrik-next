import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailBoxBodyHtml,
  emailButtonHtml,
  emailDetailRowHtml,
  emailDetailTableHtml,
  emailHeadlineHtml,
  emailHelpHtml,
  emailLeadHtml,
  emailSignOffHtml,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'
import { getEmailCopy, getLabels, t } from './content'

function stars(rating: number): string {
  const value = Math.max(1, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(value)}${'☆'.repeat(5 - value)} (${value}/5)`
}

export type NewReviewEmailDetails = {
  sellerName: string
  reviewerName: string
  productTitle: string
  productId: string
  rating: number
  reviewText?: string | null
}

export function getNewReviewReceivedEmailHtml(details: NewReviewEmailDetails): string {
  const copy = getEmailCopy('newReviewReceived')
  const labels = getLabels()
  const vars = {
    sellerName: details.sellerName,
    reviewerName: details.reviewerName,
    productTitle: details.productTitle,
  }
  const url = `${getAppBaseUrl()}/marketplace/${details.productId}`
  const trimmed = details.reviewText?.trim() || ''
  const reviewBox = trimmed
    ? emailAccentBoxHtml({
        variant: 'info',
        eyebrow: t(copy.eyebrow),
        bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.5;color:${EMAIL_THEME.heading};">${escapeHtml(trimmed)}</p>`,
      })
    : ''

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.product, t('{{productTitle}}', vars, true)) +
        emailDetailRowHtml(labels.from, t('{{reviewerName}}', vars, true)) +
        emailDetailRowHtml(labels.rating, stars(details.rating), true)
    )}
    ${reviewBox}
    ${emailButtonHtml(url, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getNewReviewReceivedEmailText(details: NewReviewEmailDetails): string {
  const copy = getEmailCopy('newReviewReceived')
  return t(copy.text, {
    sellerName: details.sellerName,
    reviewerName: details.reviewerName,
    productTitle: details.productTitle,
    ratingLabel: stars(details.rating),
    reviewBlock: details.reviewText?.trim() ? `\n${details.reviewText.trim()}\n` : '',
    url: `${getAppBaseUrl()}/marketplace/${details.productId}`,
  })
}

export type OrderReviewRequestDetails = {
  buyerName: string
  productTitle: string
  productId: string
  orderNumber: string
  orderId?: string
}

export function getOrderReviewRequestEmailHtml(details: OrderReviewRequestDetails): string {
  const copy = getEmailCopy('orderReviewRequest')
  const labels = getLabels()
  const vars = {
    buyerName: details.buyerName,
    productTitle: details.productTitle,
    orderNumber: details.orderNumber,
  }
  const url = `${getAppBaseUrl()}/marketplace/${details.productId}`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.order, t('{{orderNumber}}', vars, true)) +
        emailDetailRowHtml(labels.item, t('{{productTitle}}', vars, true), true)
    )}
    ${emailAccentBoxHtml({
      variant: 'info',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getOrderReviewRequestEmailText(details: OrderReviewRequestDetails): string {
  const copy = getEmailCopy('orderReviewRequest')
  return t(copy.text, {
    buyerName: details.buyerName,
    productTitle: details.productTitle,
    orderNumber: details.orderNumber,
    url: `${getAppBaseUrl()}/marketplace/${details.productId}`,
  })
}
