"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SellerWallet from "@/features/marketplace/components/wallet/SellerWallet";
import { getStripeConnectStatus } from "@/features/marketplace/services/adminService";

export function PayoutSettingsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (
      searchParams.get("stripe") === "return" ||
      searchParams.get("stripe") === "refresh" ||
      searchParams.get("payments") === "true"
    ) {
      getStripeConnectStatus().catch(() => null);
    }
  }, [searchParams]);

  if (authLoading) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-2xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-surface-tertiary rounded w-1/3" />
          <div className="h-64 bg-surface-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace("/signin?redirect=/marketplace/selling/payout-settings");
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/marketplace/selling")}
          className="flex items-center gap-2 text-content-secondary hover:text-content mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Selling
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-content">Payout Settings</h1>
          <p className="text-sm text-content-secondary mt-1">
            Manage saved cards and Stripe Connect payouts for marketplace orders.
          </p>
        </div>

        <SellerWallet />
      </div>
    </div>
  );
}
