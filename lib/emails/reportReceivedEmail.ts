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
import { escapeHtml, getAppBaseUrl } from './utils'
import { getEmailCopy, getLabels, t } from './content'

export type ReportReceivedDetails = {
  adminName: string
  reasonLabel: string
  postId?: string
  threadId?: string
  reportedUserId?: string
  reporterName?: string | null
}

export function getReportReceivedEmailHtml(details: ReportReceivedDetails): string {
  const copy = getEmailCopy('reportReceived')
  const labels = getLabels()
  const vars = { adminName: details.adminName, reasonLabel: details.reasonLabel }
  const isChat = Boolean(details.threadId)
  const url = isChat
    ? `${getAppBaseUrl()}/admin/reports/chat/${details.threadId}`
    : `${getAppBaseUrl()}/admin/reports/${details.postId || ''}`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.reason, escapeHtml(details.reasonLabel), true) +
        (details.reporterName
          ? emailDetailRowHtml(labels.reportedBy, escapeHtml(details.reporterName))
          : '') +
        (details.postId
          ? emailDetailRowHtml(labels.postId, escapeHtml(details.postId))
          : '') +
        (details.threadId
          ? emailDetailRowHtml('Chat thread', escapeHtml(details.threadId))
          : '') +
        (details.reportedUserId
          ? emailDetailRowHtml('Reported user', escapeHtml(details.reportedUserId))
          : '')
    )}
    ${emailAccentBoxHtml({
      variant: 'warn',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getReportReceivedEmailText(details: ReportReceivedDetails): string {
  const copy = getEmailCopy('reportReceived')
  const isChat = Boolean(details.threadId)
  return t(copy.text, {
    adminName: details.adminName,
    reasonLabel: details.reasonLabel,
    postId: details.postId || details.threadId || details.reportedUserId || '',
    reporterLine: details.reporterName ? `Reported by: ${details.reporterName}\n` : '',
    url: isChat
      ? `${getAppBaseUrl()}/admin/reports/chat/${details.threadId}`
      : `${getAppBaseUrl()}/admin/reports/${details.postId || ''}`,
  })
}
