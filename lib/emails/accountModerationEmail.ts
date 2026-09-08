import {
  emailAccentBoxHtml,
  emailBoxBodyHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailHelpHtml,
  emailLeadHtml,
  emailSignOffHtml,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'
import { getEmailCopy, t } from './content'

export function getAccountSuspendedEmailHtml(userName: string, reason?: string | null): string {
  const copy = getEmailCopy('accountSuspended')
  const vars = { userName }
  const trimmed = reason?.trim()

  const reasonHtml = trimmed
    ? emailAccentBoxHtml({
        variant: 'danger',
        eyebrow: t(copy.eyebrow),
        bodyHtml: emailBoxBodyHtml(escapeHtml(trimmed)),
      })
    : emailAccentBoxHtml({
        variant: 'danger',
        eyebrow: t(copy.fallbackEyebrow),
        bodyHtml: emailBoxBodyHtml(t(copy.fallbackBoxBody, vars, true)),
      })

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${reasonHtml}
    ${emailButtonHtml(`${getAppBaseUrl()}/support`, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getAccountSuspendedEmailText(userName: string, reason?: string | null): string {
  const copy = getEmailCopy('accountSuspended')
  return t(copy.text, {
    userName,
    reasonLine: reason?.trim() ? `\nReason: ${reason.trim()}\n` : '\n',
    supportUrl: `${getAppBaseUrl()}/support`,
  })
}

export function getAccountReactivatedEmailHtml(userName: string): string {
  const copy = getEmailCopy('accountReactivated')
  const vars = { userName }

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailAccentBoxHtml({
      variant: 'success',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(`${getAppBaseUrl()}/signin`, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getAccountReactivatedEmailText(userName: string): string {
  const copy = getEmailCopy('accountReactivated')
  return t(copy.text, { userName, signinUrl: `${getAppBaseUrl()}/signin` })
}
