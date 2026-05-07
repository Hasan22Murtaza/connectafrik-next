import type { ReactNode } from "react";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <div className="px-2 py-2 sm:px-4 sm:py-4">{children}</div>;
}
