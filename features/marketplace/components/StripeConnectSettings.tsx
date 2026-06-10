"use client";

import {
  getStripeConnectStatus,
  startStripeConnectOnboarding,
} from "@/features/marketplace/services/adminService";
import { AlertCircle, CheckCircle, CreditCard, ExternalLink } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const StripeConnectSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await getStripeConnectStatus();
      setStatus(data);
    } catch {
      toast.error("Failed to load Stripe Connect status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await startStripeConnectOnboarding();
      window.location.href = url;
    } catch {
      toast.error("Failed to start Stripe Connect onboarding");
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-6 bg-surface-tertiary rounded w-1/2 mb-4" />
        <div className="h-20 bg-surface-tertiary rounded" />
      </div>
    );
  }

  const enabled = Boolean(status?.enabled);
  const onboarded = Boolean(status?.stripe_connect_onboarded);
  const payoutsEnabled = Boolean(status?.stripe_connect_payouts_enabled);
  const reserveBalance = Number(status?.seller_reserve_balance ?? 0);

  return (
    <div className="card">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-indigo-600" />
          <div>
            <h2 className="text-xl font-semibold text-content">Stripe Connect</h2>
            <p className="text-sm text-content-secondary mt-1">
              Receive USD, EUR, and GBP payouts directly to your Stripe account.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {!enabled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            Stripe Connect is not configured on this platform yet.
          </div>
        )}

        {onboarded && payoutsEnabled ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Stripe Connect active</p>
              <p className="text-sm text-green-700 mt-1">
                Your account is ready to receive international payouts after delivery confirmation.
              </p>
            </div>
          </div>
        ) : onboarded ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Onboarding submitted — Stripe is verifying your account. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            Connect your Stripe account to receive payouts for orders paid in USD, EUR, or GBP.
            African currency orders continue to use Paystack (bank / mobile money).
          </div>
        )}

        {reserveBalance !== 0 && (
          <div className="text-sm text-content-secondary">
            Seller reserve balance:{" "}
            <span className="font-medium">${reserveBalance.toLocaleString()}</span>
            <span className="text-content-tertiary ml-1">(chargeback protection)</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {enabled && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {onboarded ? "Update Stripe account" : "Connect with Stripe"}
            </button>
          )}
          <button
            onClick={loadStatus}
            disabled={loading}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-hover"
          >
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
};

export default StripeConnectSettings;
