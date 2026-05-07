"use client";

import React, { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import ChatWindow from "@/features/chat/components/ChatWindow";
import ChatSidebar from "@/features/chat/components/ChatSidebar";

interface ChatPageViewProps {
  selectedThreadId?: string;
}

export default function ChatPageView({ selectedThreadId }: ChatPageViewProps) {
  const router = useRouter();
  const { openThread } = useProductionChat();

  useEffect(() => {
    if (!selectedThreadId) return;
    openThread(selectedThreadId);
  }, [selectedThreadId, openThread]);

  const openOnPage = useCallback(
    (threadId: string) => {
      openThread(threadId);
      router.push(`/chat/${threadId}`);
    },
    [openThread, router]
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] w-full overflow-hidden border border-gray-200 bg-white shadow-sm">
      <ChatSidebar selectedThreadId={selectedThreadId} onOpenThread={openOnPage} />

      <main
        className={`min-w-0 flex-1  ${
          selectedThreadId ? "flex" : "hidden sm:flex"
        }`}
      >
        {selectedThreadId ? (
          <ChatWindow threadId={selectedThreadId} variant="page" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Select a chat to start messaging.
          </div>
        )}
      </main>
    </div>
  );
}
