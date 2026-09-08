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

export type FriendRequestEmailDetails = {
  recipientName: string
  actorName: string
  actorId?: string
}

export function getFriendRequestReceivedEmailHtml(details: FriendRequestEmailDetails): string {
  const copy = getEmailCopy('friendRequestReceived')
  const vars = { recipientName: details.recipientName, actorName: details.actorName }
  const url = `${getAppBaseUrl()}/friends?tab=requests`

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

export function getFriendRequestReceivedEmailText(details: FriendRequestEmailDetails): string {
  const copy = getEmailCopy('friendRequestReceived')
  return t(copy.text, {
    recipientName: details.recipientName,
    actorName: details.actorName,
    url: `${getAppBaseUrl()}/friends?tab=requests`,
  })
}

export function getFriendRequestAcceptedEmailHtml(details: FriendRequestEmailDetails): string {
  const copy = getEmailCopy('friendRequestAccepted')
  const vars = { recipientName: details.recipientName, actorName: details.actorName }
  const url = details.actorId
    ? `${getAppBaseUrl()}/user/${details.actorId}`
    : `${getAppBaseUrl()}/friends`

  return `
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${emailAccentBoxHtml({
      variant: 'success',
      eyebrow: t(copy.eyebrow),
      bodyHtml: emailBoxBodyHtml(t(copy.boxBody, vars, true)),
    })}
    ${emailButtonHtml(url, t(copy.buttonLabel, vars, true))}
    ${emailHelpHtml()}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getFriendRequestAcceptedEmailText(details: FriendRequestEmailDetails): string {
  const copy = getEmailCopy('friendRequestAccepted')
  const url = details.actorId
    ? `${getAppBaseUrl()}/user/${details.actorId}`
    : `${getAppBaseUrl()}/friends`
  return t(copy.text, {
    recipientName: details.recipientName,
    actorName: details.actorName,
    url,
  })
}
