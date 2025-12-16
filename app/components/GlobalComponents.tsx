'use client'

import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'

// Dynamically import components that might have SSR issues
const DynamicChatDock = dynamic(() => import('@/features/chat/components/ChatDock'), {
  ssr: false,
})

const DynamicMobileChatButton = dynamic(() => import('@/features/chat/components/MobileChatButton'), {
  ssr: false,
})

const DynamicFriendRequestNotifications = dynamic(() => import('@/features/social/components/FriendRequestNotifications'), {
  ssr: false,
})

const DynamicGlobalCallNotification = dynamic(() => import('@/shared/components/ui/GlobalCallNotification'), {
  ssr: false,
})

export default function GlobalComponents() {
  const { user } = useAuth()

  return (
    <>
      {user && <DynamicChatDock />}
      {user && <DynamicMobileChatButton />}
      {user && <DynamicFriendRequestNotifications />}
      {user && <DynamicGlobalCallNotification />}
    </>
  )
}

