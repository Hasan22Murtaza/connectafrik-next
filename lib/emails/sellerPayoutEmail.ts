import { getCurrencySymbol } from './currency'
import {
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
import { getAppBaseUrl } from './utils'
import { getEmailCopy, getLabels, t } from './content'

export type SellerPayoutEmailDetails = {
  sellerName: string
  amount: number
  currency: string
  orderNumber?: string | null
  reference?: string | null
  failureReason?: string | null
}

function payoutVars(details: SellerPayoutEmailDetails) {
  return {
    sellerName: details.sellerName,
    amount: `${getCurrencySymbol(details.currency)}${Number(details.amount || 0).toLocaleString()}`,
    orderNumber: details.orderNumber || '',
    reference: details.reference || '',
    failureReason:
      details.failureReason?.trim() || t(getEmailCopy('sellerPayoutFailed').defaultFailureReason),
  }
}

export function getSellerPayoutEmailHtml(details: SellerPayoutEmailDetails): string {
  const copy = getEmailCopy('sellerPayout')
  const labels = getLabels()
  const vars = payoutVars(details)
  const url = `${getAppBaseUrl()}/marketplace/selling/payout-settings`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.amount, vars.amount, true) +
        (details.orderNumber
          ? emailDetailRowHtml(labels.order, t('{{orderNumber}}', vars, true))
          : '') +
        (details.reference
          ? emailDetailRowHtml(labels.reference, t('{{reference}}', vars, true))
          : '') +
        emailDetailRowHtml(labels.status, t(copy.statusLabel))
    )}
    ${emailAccentBoxHtml({
      variant: 'success',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getSellerPayoutEmailText(details: SellerPayoutEmailDetails): string {
  const copy = getEmailCopy('sellerPayout')
  const vars = payoutVars(details)
  return t(copy.text, {
    ...vars,
    orderLine: details.orderNumber ? `\nOrder: ${details.orderNumber}` : '',
    referenceLine: details.reference ? `\nReference: ${details.reference}` : '',
    url: `${getAppBaseUrl()}/marketplace/selling/payout-settings`,
  })
}

export function getSellerPayoutFailedEmailHtml(details: SellerPayoutEmailDetails): string {
  const copy = getEmailCopy('sellerPayoutFailed')
  const labels = getLabels()
  const vars = payoutVars(details)
  const url = `${getAppBaseUrl()}/marketplace/selling/payout-settings`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.amount, vars.amount, true) +
        (details.orderNumber
          ? emailDetailRowHtml(labels.order, t('{{orderNumber}}', vars, true))
          : '') +
        emailDetailRowHtml(labels.status, t(copy.statusLabel))
    )}
    ${emailAccentBoxHtml({
      variant: 'danger',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t('{{failureReason}}', vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getSellerPayoutFailedEmailText(details: SellerPayoutEmailDetails): string {
  const copy = getEmailCopy('sellerPayoutFailed')
  const vars = payoutVars(details)
  return t(copy.text, {
    ...vars,
    orderLine: details.orderNumber ? `\nOrder: ${details.orderNumber}` : '',
    url: `${getAppBaseUrl()}/marketplace/selling/payout-settings`,
  })
}
