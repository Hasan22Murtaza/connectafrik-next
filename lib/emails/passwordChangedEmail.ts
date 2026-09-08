import {
  emailAccentBoxHtml,
  emailBoxBodyHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailHelpHtml,
  emailLeadHtml,
  emailSignOffHtml,
} from './emailTheme'
import { getAppBaseUrl } from './utils'
import { getEmailCopy, t } from './content'

export function getPasswordChangedEmailHtml(userName: string): string {
  const copy = getEmailCopy('passwordChanged')
  const vars = { userName }
  const settingsUrl = `${getAppBaseUrl()}/settings`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailAccentBoxHtml({
      variant: 'warn',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(settingsUrl, t(copy.buttonLabel))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getPasswordChangedEmailText(userName: string): string {
  const copy = getEmailCopy('passwordChanged')
  return t(copy.text, { userName, settingsUrl: `${getAppBaseUrl()}/settings` })
}
