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

export type GroupJoinEmailDetails = {
  recipientName: string
  groupName: string
  groupId: string
  actorName: string
}

function groupVars(details: GroupJoinEmailDetails) {
  return {
    recipientName: details.recipientName,
    groupName: details.groupName,
    actorName: details.actorName,
  }
}

export function getGroupJoinRequestEmailHtml(details: GroupJoinEmailDetails): string {
  const copy = getEmailCopy('groupJoinRequest')
  const vars = groupVars(details)
  const url = `${getAppBaseUrl()}/groups/${details.groupId}?tab=requests`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
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

export function getGroupJoinRequestEmailText(details: GroupJoinEmailDetails): string {
  const copy = getEmailCopy('groupJoinRequest')
  return t(copy.text, {
    ...groupVars(details),
    url: `${getAppBaseUrl()}/groups/${details.groupId}?tab=requests`,
  })
}

export function getGroupRequestApprovedEmailHtml(details: GroupJoinEmailDetails): string {
  const copy = getEmailCopy('groupRequestApproved')
  const vars = groupVars(details)
  const url = `${getAppBaseUrl()}/groups/${details.groupId}`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
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

export function getGroupRequestApprovedEmailText(details: GroupJoinEmailDetails): string {
  const copy = getEmailCopy('groupRequestApproved')
  return t(copy.text, {
    ...groupVars(details),
    url: `${getAppBaseUrl()}/groups/${details.groupId}`,
  })
}

export function getGroupRequestRejectedEmailHtml(details: GroupJoinEmailDetails): string {
  const copy = getEmailCopy('groupRequestRejected')
  const vars = groupVars(details)
  const url = `${getAppBaseUrl()}/groups/${details.groupId}`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
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

export function getGroupRequestRejectedEmailText(details: GroupJoinEmailDetails): string {
  const copy = getEmailCopy('groupRequestRejected')
  return t(copy.text, {
    ...groupVars(details),
    url: `${getAppBaseUrl()}/groups/${details.groupId}`,
  })
}
