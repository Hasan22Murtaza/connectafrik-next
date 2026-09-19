/**
 * Decision-table checks for notification preference gates. Run with:
 *   npx --yes tsx lib/notifications/runRulesCheck.ts
 */
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  allowsInAppNotification,
  allowsNotificationEmail,
  allowsPushNotification,
  normalizeNotificationSettings,
  preferenceForNotificationType,
  type NotificationSettings,
} from './prefs'
import { extractMentionUsernames } from './mentions'

let failed = 0
let passed = 0

function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed += 1
    return
  }
  failed += 1
  console.error(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const allOn: NotificationSettings = {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  post_updates: true,
}

const allOff: NotificationSettings = {
  email_notifications: false,
  push_notifications: false,
  comment_notifications: false,
  like_notifications: false,
  follow_notifications: false,
  message_notifications: false,
  mention_notifications: false,
  post_updates: false,
}

check('null prefs inherit UI defaults', normalizeNotificationSettings(null).follow_notifications, true)
check('null post_updates defaults off', normalizeNotificationSettings(null).post_updates, false)
check('explicit false is kept', normalizeNotificationSettings({ follow_notifications: false }).follow_notifications, false)

check('follow maps follow_notifications', preferenceForNotificationType('follow'), 'follow_notifications')
check('friend_request maps follow_notifications', preferenceForNotificationType('friend_request'), 'follow_notifications')
check('friend_request_accepted maps follow_notifications', preferenceForNotificationType('friend_request_accepted'), 'follow_notifications')
check('chat_message maps message_notifications', preferenceForNotificationType('chat_message'), 'message_notifications')
check('post_comment maps comment_notifications', preferenceForNotificationType('post_comment'), 'comment_notifications')
check('reel_comment maps comment_notifications', preferenceForNotificationType('reel_comment'), 'comment_notifications')
check('legacy comment maps comment_notifications', preferenceForNotificationType('comment'), 'comment_notifications')
check('post_like maps like_notifications', preferenceForNotificationType('post_like'), 'like_notifications')
check('legacy like maps like_notifications', preferenceForNotificationType('like'), 'like_notifications')
check('post_comment_like maps like_notifications', preferenceForNotificationType('post_comment_like'), 'like_notifications')
check('mention maps mention_notifications', preferenceForNotificationType('mention'), 'mention_notifications')
check('post_create maps post_updates', preferenceForNotificationType('post_create'), 'post_updates')
check('reel_create maps post_updates', preferenceForNotificationType('reel_create'), 'post_updates')
check('call has no category', preferenceForNotificationType('call'), null)
check('group_invite has no category', preferenceForNotificationType('group_invite'), null)
check('birthday has no category', preferenceForNotificationType('birthday'), null)

check('follow off blocks in-app', allowsInAppNotification({ ...allOn, follow_notifications: false }, 'follow'), false)
check('follow off blocks friend request', allowsInAppNotification({ ...allOn, follow_notifications: false }, 'friend_request'), false)
check('follow off still allows comments', allowsInAppNotification({ ...allOn, follow_notifications: false }, 'post_comment'), true)
check('messages off blocks chat push category', allowsInAppNotification({ ...allOn, message_notifications: false }, 'chat_message'), false)
check('messages off does not block calls', allowsInAppNotification({ ...allOn, message_notifications: false }, 'call'), true)
check('comments off blocks post comments', allowsInAppNotification({ ...allOn, comment_notifications: false }, 'post_comment'), false)
check('likes off blocks reactions', allowsInAppNotification({ ...allOn, like_notifications: false }, 'post_like'), false)
check('mentions off blocks mentions', allowsInAppNotification({ ...allOn, mention_notifications: false }, 'mention'), false)
check('post updates off blocks post_create', allowsInAppNotification({ ...allOn, post_updates: false }, 'post_create'), false)
check('post updates on allows post_create', allowsInAppNotification(allOn, 'post_create'), true)

check('push off blocks push even if category on', allowsPushNotification({ ...allOn, push_notifications: false }, 'follow'), false)
check('push on and category off still blocks', allowsPushNotification({ ...allOn, follow_notifications: false }, 'follow'), false)
check('push on and category on allows', allowsPushNotification(allOn, 'follow'), true)
check('push off still allows in-app', allowsInAppNotification({ ...allOn, push_notifications: false }, 'follow'), true)

check('email off blocks SES', allowsNotificationEmail({ ...allOn, email_notifications: false }, 'friend_request'), false)
check('email on and category off blocks SES', allowsNotificationEmail({ ...allOn, follow_notifications: false }, 'friend_request'), false)
check('email on and category on allows SES', allowsNotificationEmail(allOn, 'friend_request'), true)
check('email on allows uncategorized events', allowsNotificationEmail(allOn, 'group_invite'), true)
check('email off blocks uncategorized events', allowsNotificationEmail({ ...allOn, email_notifications: false }, 'group_invite'), false)
check('all off in-app still allows uncategorized', allowsInAppNotification(allOff, 'call'), true)
check('all off push blocks uncategorized', allowsPushNotification(allOff, 'call'), false)

check('extracts @username', extractMentionUsernames('hey @Ada welcome')[0], 'Ada')
check('ignores email addresses', extractMentionUsernames('email me at ada@example.com').length, 0)
check('extracts starting mention', extractMentionUsernames('@Kwame check this')[0], 'Kwame')

if (failed > 0) {
  console.error(`Notification rules check failed: ${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`Notification rules check passed: ${passed} assertions`)
