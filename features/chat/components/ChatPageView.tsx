"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import ChatCloseView from "@/features/chat/components/ChatCloseView";
import ChatWindow from "@/features/chat/components/ChatWindow";
import ChatSidebar from "@/features/chat/components/ChatSidebar";
import type { ChatThread } from "@/features/chat/services/supabaseMessagingService";

interface ChatPageViewProps {
  selectedThreadId?: string;
}

export default function ChatPageView({ selectedThreadId }: ChatPageViewProps) {
  const router = useRouter();
  const { openThread } = useProductionChat();
  const sidebarSearchRef = useRef<HTMLInputElement>(null);

  const focusSidebarSearch = useCallback(() => {
    sidebarSearchRef.current?.focus();
    sidebarSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  useEffect(() => {
    if (!selectedThreadId) return;
    openThread(selectedThreadId);
  }, [selectedThreadId, openThread]);

  const openOnPage = useCallback(
    (threadId: string, seedThread?: ChatThread) => {
      openThread(threadId, seedThread ?? null);
      router.push(`/chat/${encodeURIComponent(threadId)}`);
    },
    [openThread, router]
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] w-full overflow-hidden rounded-none sm:rounded-2xl border border-1 border-gray-200 ">
      <ChatSidebar
        selectedThreadId={selectedThreadId}
        onOpenThread={openOnPage}
        searchInputRef={sidebarSearchRef}
      />

      <main
        className={`min-w-0 flex-1  ${
          selectedThreadId ? "flex" : "hidden sm:flex"
        }`}
      >
        {selectedThreadId ? (
          <ChatWindow threadId={selectedThreadId} variant="page" />
        ) : (
          <ChatCloseView onFocusSearch={focusSidebarSearch} />
        )}
      </main>
    </div>
  );
}
