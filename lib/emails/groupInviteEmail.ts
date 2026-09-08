import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailHintHtml,
  emailLeadHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'
import { getEmailCopy, t } from './content'

export function getGroupInviteEmailHtml(params: {
  groupName: string
  inviterName: string
  groupImageUrl?: string | null
  invitationMessage?: string | null
  groupId: string
}): string {
  const copy = getEmailCopy('groupInvite')
  const { groupName, inviterName, groupImageUrl, invitationMessage, groupId } = params
  const vars = { groupName, inviterName }
  const groupUrl = `${getAppBaseUrl()}/groups/${groupId}`
  const trimmedMessage = invitationMessage?.trim() || ''

  const imageHtml = groupImageUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td>
            <img src="${escapeHtml(groupImageUrl)}" alt="${escapeHtml(groupName)}" width="120" height="120" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:1px solid ${EMAIL_THEME.border};display:block;" />
          </td>
        </tr>
      </table>`
    : ''

  const messageHtml = trimmedMessage
    ? emailAccentBoxHtml({
        variant: 'info',
        eyebrow: t(copy.eyebrow),
        bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.5;color:${EMAIL_THEME.heading};">${escapeHtml(trimmedMessage)}</p>`,
      })
    : ''

  return `
    ${imageHtml}
    ${emailHeadlineHtml(t(copy.headline, vars, true))}
    ${emailLeadHtml(t(copy.lead, vars, true))}
    ${messageHtml}
    ${emailButtonHtml(groupUrl, t(copy.buttonLabel))}
    ${emailHintHtml(t(copy.hint))}
    ${emailSignOffHtml(t(copy.signOff))}
  `
}

export function getGroupInviteEmailText(params: {
  groupName: string
  inviterName: string
  invitationMessage?: string | null
  groupId: string
}): string {
  const copy = getEmailCopy('groupInvite')
  const { groupName, inviterName, invitationMessage, groupId } = params
  const base = getAppBaseUrl()
  const support = supportEmailPlain()
  const messageBlock = invitationMessage?.trim()
    ? `\nMessage from ${inviterName}:\n${invitationMessage.trim()}\n`
    : ''

  return t(copy.text, {
    groupName,
    inviterName,
    messageBlock,
    groupUrl: `${base}/groups/${groupId}`,
    supportLine: support ? `\nHelp: ${support}\n` : '',
  })
}
