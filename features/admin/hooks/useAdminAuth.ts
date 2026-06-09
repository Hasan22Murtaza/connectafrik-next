"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function useAdminAuth(redirectPath: string) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/signin?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [user, authLoading, router, redirectPath]);

  return {
    user,
    authLoading,
    isReady: !authLoading && !!user,
  };
}
