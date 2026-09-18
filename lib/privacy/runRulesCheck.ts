/**
 * Decision-table checks for privacy rules. Run with:
 *   npx --yes tsx lib/privacy/runRulesCheck.ts
 */
import {
  canCall,
  canComment,
  canFollow,
  canSendFriendRequest,
  canSendMessage,
  canViewLastSeen,
  canViewOnlineStatus,
  canViewPost,
  canViewProfile,
  canViewReadReceipt,
} from '@/shared/utils/visibilityUtils'

type Visibility = 'public' | 'friends' | 'private' | 'everyone' | 'none'

const A = 'user-a'
const B = 'user-b'

let failed = 0
let passed = 0

function check(name: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    passed += 1
    return
  }
  failed += 1
  console.error(`FAIL ${name}: expected ${expected}, got ${actual}`)
}

function matrix(
  label: string,
  fn: (isFriend: boolean, isBlocked: boolean, level: Visibility) => boolean,
  expected: {
    publicFriend: boolean
    publicNonFriend: boolean
    publicBlocked: boolean
    friendsFriend: boolean
    friendsNonFriend: boolean
    friendsBlocked: boolean
    privateFriend: boolean
    privateNonFriend: boolean
    privateBlocked: boolean
  }
) {
  check(`${label} public/friend`, fn(true, false, 'public'), expected.publicFriend)
  check(`${label} public/non-friend`, fn(false, false, 'public'), expected.publicNonFriend)
  check(`${label} public/blocked`, fn(false, true, 'public'), expected.publicBlocked)
  check(`${label} friends/friend`, fn(true, false, 'friends'), expected.friendsFriend)
  check(`${label} friends/non-friend`, fn(false, false, 'friends'), expected.friendsNonFriend)
  check(`${label} friends/blocked`, fn(true, true, 'friends'), expected.friendsBlocked)
  check(`${label} private/friend`, fn(true, false, 'private'), expected.privateFriend)
  check(`${label} private/non-friend`, fn(false, false, 'private'), expected.privateNonFriend)
  check(`${label} private/blocked`, fn(false, true, 'private'), expected.privateBlocked)
}

matrix(
  'View Profile',
  (isFriend, isBlocked, level) => canViewProfile(B, A, level, isFriend, isBlocked),
  {
    publicFriend: true,
    publicNonFriend: true,
    publicBlocked: false,
    friendsFriend: true,
    friendsNonFriend: false,
    friendsBlocked: false,
    privateFriend: false,
    privateNonFriend: false,
    privateBlocked: false,
  }
)

matrix(
  'View Posts',
  (isFriend, isBlocked, level) => canViewPost(B, A, level, isFriend, isBlocked),
  {
    publicFriend: true,
    publicNonFriend: true,
    publicBlocked: false,
    friendsFriend: true,
    friendsNonFriend: false,
    friendsBlocked: false,
    privateFriend: false,
    privateNonFriend: false,
    privateBlocked: false,
  }
)

matrix(
  'Send Friend Request',
  (isFriend, isBlocked, level) => {
    const allow = level === 'private' ? 'none' : level === 'friends' ? 'friends' : 'everyone'
    return canSendFriendRequest(B, A, allow, isFriend, isBlocked)
  },
  {
    publicFriend: true,
    publicNonFriend: true,
    publicBlocked: false,
    friendsFriend: true,
    friendsNonFriend: false,
    friendsBlocked: false,
    privateFriend: false,
    privateNonFriend: false,
    privateBlocked: false,
  }
)

matrix(
  'Send Message',
  (isFriend, isBlocked, level) => {
    const allow = level === 'private' ? 'none' : level === 'friends' ? 'friends' : 'everyone'
    return canSendMessage(B, A, allow, isFriend, isBlocked)
  },
  {
    publicFriend: true,
    publicNonFriend: true,
    publicBlocked: false,
    friendsFriend: true,
    friendsNonFriend: false,
    friendsBlocked: false,
    privateFriend: false,
    privateNonFriend: false,
    privateBlocked: false,
  }
)

check('Make Call friend', canCall(B, A, true, false, false), true)
check('Make Call non-friend', canCall(B, A, false, false, false), false)
check('Make Call blocked friend', canCall(B, A, true, true, false), false)
check('Make Call group non-friend', canCall(B, A, false, false, true), true)
check('Make Call group blocked', canCall(B, A, false, true, true), false)

check('View Online Status on', canViewOnlineStatus(B, A, true, false), true)
check('View Online Status off', canViewOnlineStatus(B, A, false, false), false)
check('View Online Status blocked', canViewOnlineStatus(B, A, true, true), false)
check('View Last Seen on', canViewLastSeen(B, A, true, false), true)
check('View Last Seen off', canViewLastSeen(B, A, false, false), false)
check('View Last Seen blocked', canViewLastSeen(B, A, true, true), false)

check('View Read Receipt on', canViewReadReceipt(B, A, true, false), true)
check('View Read Receipt off', canViewReadReceipt(B, A, false, false), false)
check('View Read Receipt blocked', canViewReadReceipt(B, A, true, true), false)
check('View Read Receipt self', canViewReadReceipt(A, A, false, false), true)

check('Owner can view private profile', canViewProfile(A, A, 'private', false, false), true)
check('Owner can view private post', canViewPost(A, A, 'private', false, false), true)
check('Anonymous cannot view friends profile', canViewProfile(null, A, 'friends', false, false), false)
check('Anonymous can view public profile', canViewProfile(null, A, 'public', false, false), true)
check('Comment none', canComment(B, A, 'none', true, false), false)
check('Comment friends as friend', canComment(B, A, 'friends', true, false), true)
check('Comment friends as stranger', canComment(B, A, 'friends', false, false), false)
check('Follow none', canFollow(B, A, 'none', false, false), false)

if (failed > 0) {
  console.error(`Privacy rules check failed: ${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`Privacy rules check passed: ${passed} assertions`)
