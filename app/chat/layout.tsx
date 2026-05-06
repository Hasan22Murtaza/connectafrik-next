import type { ReactNode } from "react";
import ChatRouteShell from "@/features/chat/components/ChatRouteShell";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ChatRouteShell />
      <div className="hidden">{children}</div>
    </>
  );
}
