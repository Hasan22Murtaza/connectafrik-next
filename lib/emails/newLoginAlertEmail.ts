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

export type NewLoginAlertDetails = {
  userName: string
  deviceLabel: string
  ip?: string | null
  timeLabel?: string | null
}

export function getNewLoginAlertEmailHtml(details: NewLoginAlertDetails): string {
  const copy = getEmailCopy('newLoginAlert')
  const labels = getLabels()
  const { userName, deviceLabel, ip, timeLabel } = details
  const when = timeLabel || new Date().toUTCString()
  const vars = { userName, deviceLabel }

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailDetailTableHtml(
      emailDetailRowHtml(labels.device, escapeHtml(deviceLabel)) +
        (ip ? emailDetailRowHtml(labels.ip, escapeHtml(ip)) : '') +
        emailDetailRowHtml(labels.when, escapeHtml(when), true)
    )}
    ${emailAccentBoxHtml({
      variant: 'warn',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(`${getAppBaseUrl()}/settings`, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getNewLoginAlertEmailText(details: NewLoginAlertDetails): string {
  const copy = getEmailCopy('newLoginAlert')
  const { userName, deviceLabel, ip, timeLabel } = details
  const when = timeLabel || new Date().toUTCString()
  return t(copy.text, {
    userName,
    deviceLabel,
    ipLine: ip ? `IP address: ${ip}\n` : '',
    timeLabel: when,
    settingsUrl: `${getAppBaseUrl()}/settings`,
  })
}
