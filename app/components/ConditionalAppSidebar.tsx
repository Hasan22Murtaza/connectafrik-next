"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LeftSidebar from "@/shared/components/ui/LeftSidebar";
import {
  isAppChromePath,
  shouldHideAppSidebar,
} from "@/shared/utils/appPaths";

/**
 * Global app chrome: Supabase-style left nav on all authenticated pages.
 * Page-specific secondary sidebars (Friends, Settings, TradeHub, Chat) sit beside it.
 *
 * During auth hydration on app routes, keep the shell so a hard refresh does not
 * collapse into a guest full-width layout (middleware already gates these paths).
 */
export default function ConditionalAppSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const hide = shouldHideAppSidebar(pathname);
  const showSidebar =
    !hide && (Boolean(user) || (loading && isAppChromePath(pathname)));

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex w-full min-w-0 items-start">
      <LeftSidebar />
      <div className="min-w-0 flex-1 overflow-x-clip">{children}</div>
    </div>
  );
}
