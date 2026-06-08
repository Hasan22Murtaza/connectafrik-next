"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Shield,
  DollarSign,
  Package,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
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

const AdminMarketplaceDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin?redirect=/admin/marketplace/dashboard");
      return;
    }

    getAdminDashboard()
      .then(setSummary)
      .catch(() => toast.error("Admin access required or dashboard unavailable"))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (loading || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  const revenue = summary.revenue as Record<string, number> | null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Link href="/admin/marketplace" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
              ← Admin hub
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-primary-600" />
              Marketplace Admin
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor transactions, payouts, disputes, and escrow across all currencies.
            </p>
          </div>
          <Link
            href="/admin/marketplace/disputes"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            Dispute queue ({summary.open_disputes})
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs uppercase mb-1">
              <Package className="w-3.5 h-3.5" /> Orders
            </div>
            <p className="text-2xl font-bold">{summary.total_orders}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs uppercase mb-1">
              <DollarSign className="w-3.5 h-3.5" /> Payouts
            </div>
            <p className="text-2xl font-bold">{summary.total_payouts}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-orange-600 text-xs uppercase mb-1">
              <Shield className="w-3.5 h-3.5" /> Open disputes
            </div>
            <p className="text-2xl font-bold text-orange-600">{summary.open_disputes}</p>
            {summary.dispute_sla_breaches > 0 && (
              <p className="text-xs text-red-600 mt-1">{summary.dispute_sla_breaches} SLA breach</p>
            )}
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-red-600 text-xs uppercase mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Chargebacks
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.open_chargebacks}</p>
          </div>
        </div>

        {revenue && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase">Total GMV</p>
              <p className="text-xl font-bold text-gray-900">
                {Number(revenue.total_gmv ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase">Commission revenue</p>
              <p className="text-xl font-bold text-green-600">
                {Number(revenue.total_commission_revenue ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase">Pending revenue</p>
              <p className="text-xl font-bold text-amber-600">
                {Number(revenue.pending_revenue ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <CurrencyBreakdown title="GMV by currency" data={summary.gmv_by_currency} />
          <CurrencyBreakdown title="Escrow held (seller net)" data={summary.escrow_by_currency} />
          <CurrencyBreakdown title="Refunds by currency" data={summary.refunds_by_currency} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 font-medium text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Recent orders
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
                    <td className="px-4 py-2 capitalize">{order.status}</td>
                    <td className="px-4 py-2 capitalize">{order.escrow_status || "—"}</td>
                    <td className="px-4 py-2 capitalize">{order.payout_status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMarketplaceDashboard;
