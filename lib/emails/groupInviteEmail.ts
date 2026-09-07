import {
  EMAIL_THEME,
  emailAccentBoxHtml,
  emailButtonHtml,
  emailHeadlineHtml,
  emailLeadHtml,
  emailSignOffHtml,
  supportEmailPlain,
} from './emailTheme'
import { escapeHtml, getAppBaseUrl } from './utils'

export function getGroupInviteEmailHtml(params: {
  groupName: string
  inviterName: string
  groupImageUrl?: string | null
  invitationMessage?: string | null
  groupId: string
}): string {
  const { groupName, inviterName, groupImageUrl, invitationMessage, groupId } = params
  const safeGroup = escapeHtml(groupName)
  const safeInviter = escapeHtml(inviterName)
  const base = getAppBaseUrl()
  const groupUrl = `${base}/groups/${groupId}`
  const supportPlain = supportEmailPlain()
  const trimmedMessage = invitationMessage?.trim() || ''

  const imageHtml = groupImageUrl
    ? `<div style="text-align:center;margin:0 0 24px;">
        <img src="${escapeHtml(groupImageUrl)}" alt="${safeGroup}" width="120" height="120" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:1px solid ${EMAIL_THEME.border};" />
      </div>`
    : ''

  const messageHtml = trimmedMessage
    ? emailAccentBoxHtml({
        variant: 'info',
        eyebrow: 'Invitation message',
        bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.5;color:${EMAIL_THEME.heading};">${escapeHtml(trimmedMessage)}</p>`,
      })
    : ''

  const supportBlock = supportPlain
    ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:${EMAIL_THEME.text};text-align:center;">
        Questions? Reach us at <a href="mailto:${escapeHtml(supportPlain)}" style="color:${EMAIL_THEME.link};">${escapeHtml(supportPlain)}</a>.
      </p>`
    : ''

  return `
    ${imageHtml}
    ${emailHeadlineHtml(`You're invited to ${safeGroup}`)}
    ${emailLeadHtml(`${safeInviter} invited you to join ${safeGroup} on ConnectAfrik.`)}
    ${messageHtml}
    ${emailButtonHtml(groupUrl, 'Accept invitation')}
    <p style="text-align:center;margin:0;font-size:14px;color:${EMAIL_THEME.text};">
      Open the group to accept the invitation and see posts, members, and upcoming events.
    </p>
    ${supportBlock}
    ${emailSignOffHtml('See you in the group,')}
  `
}

export function getGroupInviteEmailText(params: {
  groupName: string
  inviterName: string
  invitationMessage?: string | null
  groupId: string
}): string {
  const { groupName, inviterName, invitationMessage, groupId } = params
  const base = getAppBaseUrl()
  const groupUrl = `${base}/groups/${groupId}`
  const support = supportEmailPlain()
  const supportLine = support ? `\nHelp: ${support}\n` : ''
  const messageBlock = invitationMessage?.trim()
    ? `\nMessage from ${inviterName}:\n${invitationMessage.trim()}\n`
    : ''

  return `You're invited to ${groupName}

${inviterName} invited you to join ${groupName} on ConnectAfrik.
${messageBlock}
Accept the invitation: ${groupUrl}
${supportLine}
— The ConnectAfrik team
`
}
