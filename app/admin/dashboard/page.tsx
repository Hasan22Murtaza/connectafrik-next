"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Shield,
  DollarSign,
  Package,
  AlertTriangle,
  TrendingUp,
  Wallet,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import {
  getAdminDashboard,
  AdminDashboardSummary,
} from "@/features/marketplace/services/adminService";

function CurrencyBreakdown({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className={`${MP.card} ${MP.cardPadding}`}>
      <h3 className="text-sm font-medium text-gray-500 mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map(([currency, amount]) => (
          <div key={currency} className="flex justify-between text-sm">
            <span className="text-gray-600">{currency}</span>
            <span className="font-semibold text-gray-900">
              {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  {
    href: "/admin/orders",
    label: "Manage orders",
    description: "Filter, view, and refund orders",
    icon: Package,
    color: "text-blue-600 bg-blue-50",
  },
  {
    href: "/admin/payouts",
    label: "Process payouts",
    description: "Review pending seller transfers",
    icon: Wallet,
    color: "text-green-600 bg-green-50",
  },
  {
    href: "/admin/disputes",
    label: "Resolve disputes",
    description: "Review buyer-seller cases",
    icon: Shield,
    color: "text-orange-600 bg-orange-50",
  },
] as const;

export default function AdminDashboardPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/dashboard");
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;

    getAdminDashboard()
      .then(setSummary)
      .catch(() => toast.error("Admin access required or dashboard unavailable"))
      .finally(() => setLoading(false));
  }, [isReady]);

  if (authLoading || loading || !summary) {
    return <AdminLoading message="Loading dashboard..." />;
  }

  const revenue = summary.revenue as Record<string, number> | null;

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Marketplace Dashboard"
        description="Overview of orders, revenue, escrow, payouts, and disputes."
        icon={LayoutDashboard}
        action={
          <Link
            href="/admin/disputes"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            Dispute queue ({summary.open_disputes})
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`${MP.card} ${MP.cardPadding} hover:shadow-md transition-shadow group`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${link.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{link.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{link.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className={MP.statsGrid + " mb-6"}>
        <div className={`${MP.card} ${MP.cardPadding}`}>
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase mb-1">
            <Package className="w-3.5 h-3.5" /> Orders
          </div>
          <p className="text-2xl font-bold">{summary.total_orders}</p>
        </div>
        <div className={`${MP.card} ${MP.cardPadding}`}>
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Payouts
          </div>
          <p className="text-2xl font-bold">{summary.total_payouts}</p>
        </div>
        <div className={`${MP.card} ${MP.cardPadding}`}>
          <div className="flex items-center gap-2 text-orange-600 text-xs uppercase mb-1">
            <Shield className="w-3.5 h-3.5" /> Open disputes
          </div>
          <p className="text-2xl font-bold text-orange-600">{summary.open_disputes}</p>
          {summary.dispute_sla_breaches > 0 && (
            <p className="text-xs text-red-600 mt-1">
              {summary.dispute_sla_breaches} SLA breach
            </p>
          )}
        </div>
        <div className={`${MP.card} ${MP.cardPadding}`}>
          <div className="flex items-center gap-2 text-red-600 text-xs uppercase mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Chargebacks
          </div>
          <p className="text-2xl font-bold text-red-600">{summary.open_chargebacks}</p>
        </div>
      </div>

      {revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className={`${MP.card} ${MP.cardPadding}`}>
            <p className="text-xs text-gray-500 uppercase">Total GMV</p>
            <p className="text-xl font-bold text-gray-900">
              {Number(revenue.total_gmv ?? 0).toLocaleString()}
            </p>
          </div>
          <div className={`${MP.card} ${MP.cardPadding}`}>
            <p className="text-xs text-gray-500 uppercase">Commission revenue</p>
            <p className="text-xl font-bold text-green-600">
              {Number(revenue.total_commission_revenue ?? 0).toLocaleString()}
            </p>
          </div>
          <div className={`${MP.card} ${MP.cardPadding}`}>
            <p className="text-xs text-gray-500 uppercase">Pending revenue</p>
            <p className="text-xl font-bold text-amber-600">
              {Number(revenue.pending_revenue ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <CurrencyBreakdown title="GMV by currency" data={summary.gmv_by_currency} />
        <CurrencyBreakdown title="Escrow held (seller net)" data={summary.escrow_by_currency} />
        <CurrencyBreakdown title="Refunds by currency" data={summary.refunds_by_currency} />
      </div>

      <div className={`${MP.card} overflow-hidden`}>
        <div className="px-4 py-3 border-b bg-gray-50 font-medium text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Recent orders
          </span>
          <Link href="/admin/orders" className="text-xs text-primary-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Escrow</th>
                <th className="px-4 py-2">Payout</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent_orders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/my-orders/${order.id}`}
                      className="text-primary-600 hover:underline font-mono text-xs"
                    >
                      {order.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {order.currency} {Number(order.total_amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <AdminStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-2">
                    <AdminStatusBadge status={order.escrow_status} />
                  </td>
                  <td className="px-4 py-2">
                    <AdminStatusBadge status={order.payout_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
