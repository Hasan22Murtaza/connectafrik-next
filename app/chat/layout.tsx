"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import ChatPageView from "@/features/chat/components/ChatPageView";

export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const selectedThreadId =
    parts[0] === "chat" && parts[1] ? decodeURIComponent(parts[1]) : undefined;

  return (
    <div className="px-2 py-2 sm:px-4 sm:py-4">
      <ChatPageView selectedThreadId={selectedThreadId} />
      {children}
    </div>
  );
}
