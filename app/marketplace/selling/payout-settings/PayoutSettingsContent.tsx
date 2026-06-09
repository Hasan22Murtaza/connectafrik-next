"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CreditCard, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BankAccountSettings from "@/features/marketplace/components/BankAccountSettings";
import MobileMoneySettings from "@/features/marketplace/components/MobileMoneySettings";
import StripeConnectSettings from "@/features/marketplace/components/StripeConnectSettings";
import { getStripeConnectStatus } from "@/features/marketplace/services/adminService";

type PayoutMethodTab = "bank" | "mobile_money" | "stripe_connect";

export function PayoutSettingsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PayoutMethodTab>("bank");

  useEffect(() => {
    if (searchParams.get("stripe") === "return") {
      setActiveTab("stripe_connect");
      getStripeConnectStatus().catch(() => null);
    }
  }, [searchParams]);

  if (authLoading) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-2xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace("/signin?redirect=/marketplace/selling/payout-settings");
    return null;
  }

  const tabs: { id: PayoutMethodTab; label: string; icon: React.ReactNode }[] = [
    { id: "bank", label: "Bank account", icon: <Building2 className="w-4 h-4" /> },
    { id: "mobile_money", label: "Mobile money", icon: <Smartphone className="w-4 h-4" /> },
    { id: "stripe_connect", label: "Stripe (USD/EUR/GBP)", icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/marketplace/selling")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Selling
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Payout Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Paystack for African currencies · Stripe Connect for USD, EUR, GBP.
          </p>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-lg overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "bank" && <BankAccountSettings />}
        {activeTab === "mobile_money" && <MobileMoneySettings />}
        {activeTab === "stripe_connect" && <StripeConnectSettings />}
      </div>
    </div>
  );
}
