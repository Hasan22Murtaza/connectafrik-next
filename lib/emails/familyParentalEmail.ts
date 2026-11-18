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

export type FamilyChildTurned16Details = {
  parentName: string
  childName: string
}

export type FamilyParentVerificationDetails = {
  parentName: string
  childName: string
  actionLabel: string
  type: 'birthday_change' | 'child_removal'
  token: string
}

export function getFamilyChildTurned16EmailHtml(details: FamilyChildTurned16Details): string {
  const copy = getEmailCopy('familyChildTurned16')
  const vars = { parentName: details.parentName, childName: details.childName }
  const url = `${getAppBaseUrl()}/family-circle`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailAccentBoxHtml({
      variant: 'info',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel, vars, true))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getFamilyChildTurned16EmailText(details: FamilyChildTurned16Details): string {
  const copy = getEmailCopy('familyChildTurned16')
  return t(copy.text, {
    parentName: details.parentName,
    childName: details.childName,
    url: `${getAppBaseUrl()}/family-circle`,
  })
}

export function getFamilyParentVerificationEmailHtml(
  details: FamilyParentVerificationDetails
): string {
  const copy = getEmailCopy('familyParentVerification')
  const vars = {
    parentName: details.parentName,
    childName: details.childName,
    actionLabel: details.actionLabel,
  }
  const url = `${getAppBaseUrl()}/family-circle/verify?token=${encodeURIComponent(details.token)}`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailAccentBoxHtml({
      variant: 'info',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel, vars, true))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getFamilyParentVerificationEmailText(
  details: FamilyParentVerificationDetails
): string {
  const copy = getEmailCopy('familyParentVerification')
  return t(copy.text, {
    parentName: details.parentName,
    childName: details.childName,
    actionLabel: details.actionLabel,
    url: `${getAppBaseUrl()}/family-circle/verify?token=${encodeURIComponent(details.token)}`,
  })
}
