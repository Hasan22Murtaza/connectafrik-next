"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LeftSidebar from "@/shared/components/ui/LeftSidebar";

const HIDE_EXACT = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/account-activated",
  "/confirm-signup",
  "/auth/callback",
  "/api-docs",
  "/create-password",
  "/verify-otp",
]);

function shouldHideSidebar(pathname: string | null): boolean {
  if (!pathname) return true;
  if (HIDE_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/call/")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/**
 * Global app chrome: Supabase-style left nav on all authenticated pages.
 * Page-specific secondary sidebars (Friends, Settings, TradeHub, Chat) sit beside it.
 */
export default function ConditionalAppSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if ((!loading && !user) || shouldHideSidebar(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex w-full min-w-0 items-start">
      <LeftSidebar />
      <div className="min-w-0 flex-1 overflow-x-clip">{children}</div>
    </div>
  );
}
