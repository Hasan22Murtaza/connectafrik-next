"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  Shield,
  DollarSign,
  Package,
  AlertTriangle,
  TrendingUp,
  Wallet,
  ArrowRight,
  Inbox,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { AdminStatCard } from "@/features/admin/components/AdminStatCard";
import { AdminMotion } from "@/features/admin/components/AdminMotion";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import { AdminErrorState } from "@/features/admin/components/AdminErrorState";
import {
  AdminTableBody,
  AdminTableCard,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminChartSkeleton } from "@/features/admin/components/skeletons/AdminShimmerLoaders";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  getAdminDashboard,
  AdminDashboardSummary,
} from "@/features/marketplace/services/adminService";

const AdminBarChart = dynamic(
  () => import("@/features/admin/components/AdminChart").then((m) => m.AdminBarChart),
  { loading: () => <AdminChartSkeleton />, ssr: false }
);

const AdminDonutChart = dynamic(
  () => import("@/features/admin/components/AdminChart").then((m) => m.AdminDonutChart),
  { loading: () => <AdminChartSkeleton />, ssr: false }
);

function CurrencyBreakdown({
  title,
  data,
  delay = 0,
}: {
  title: string;
  data: Record<string, number>;
  delay?: number;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <AdminMotion delay={delay} className={`${AP.card} ${AP.cardPadding} ${AP.cardHover}`}>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {title}
      </h3>
      <div className="space-y-3">
        {entries.map(([currency, amount]) => (
          <div key={currency} className="flex justify-between items-center text-sm">
            <span className="text-gray-600 font-medium">{currency}</span>
            <span className="font-bold text-gray-900 tabular-nums">
              {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </AdminMotion>
  );
}

const QUICK_LINKS = [
  {
    href: "/admin/orders",
    label: "Manage orders",
    description: "Filter, view, and refund orders",
    icon: Package,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    href: "/admin/payouts",
    label: "Process payouts",
    description: "Review pending seller transfers",
    icon: Wallet,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  {
    href: "/admin/disputes",
    label: "Resolve disputes",
    description: "Review buyer-seller cases",
    icon: Shield,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
  },
] as const;

export default function AdminDashboardPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/dashboard");
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboard = React.useCallback(() => {
    setLoading(true);
    setError(false);
    getAdminDashboard()
      .then(setSummary)
      .catch(() => {
        setError(true);
        toast.error("Admin access required or dashboard unavailable");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadDashboard();
  }, [isReady, loadDashboard]);

  if (authLoading || (loading && !summary)) {
    return <AdminLoading variant="dashboard" />;
  }

  if (error || !summary) {
    return (
      <div className="max-w-6xl mx-auto">
        <AdminErrorState
          title="Dashboard unavailable"
          message="We couldn't load marketplace metrics. Verify your admin access and try again."
          onRetry={loadDashboard}
        />
      </div>
    );
  }

  const revenue = summary.revenue as Record<string, number> | null;

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Marketplace Dashboard"
        icon={LayoutDashboard}
        action={
          <Link href="/admin/disputes" className={AP.btnPrimary}>
            <Shield className="w-4 h-4" aria-hidden="true" />
            Dispute queue ({summary.open_disputes})
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {QUICK_LINKS.map((link, i) => {
          const Icon = link.icon;
          return (
            <AdminMotion key={link.href} delay={i * 80}>
              <Link
                href={link.href}
                className={`${AP.card} ${AP.cardPadding} ${AP.cardHover} ${AP.cardInteractive} block`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${link.iconBg}`}>
                    <Icon className={`w-5 h-5 ${link.iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-primary-600 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </AdminMotion>
          );
        })}
      </div>

      <div className={`${AP.statsGrid} mb-6 sm:mb-8`}>
        <AdminMotion delay={0}>
          <AdminStatCard
            label="Total orders"
            value={summary.total_orders.toLocaleString()}
            icon={Package}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
        </AdminMotion>
        <AdminMotion delay={60}>
          <AdminStatCard
            label="Total payouts"
            value={summary.total_payouts.toLocaleString()}
            icon={DollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
        </AdminMotion>
        <AdminMotion delay={120}>
          <AdminStatCard
            label="Open disputes"
            value={summary.open_disputes}
            icon={Shield}
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
            highlight={summary.open_disputes > 0}
            footnote={
              summary.dispute_sla_breaches > 0
                ? `${summary.dispute_sla_breaches} SLA breach${summary.dispute_sla_breaches !== 1 ? "es" : ""}`
                : undefined
            }
            footnoteVariant="danger"
          />
        </AdminMotion>
        <AdminMotion delay={180}>
          <AdminStatCard
            label="Chargebacks"
            value={summary.open_chargebacks}
            icon={AlertTriangle}
            iconBg="bg-red-50"
            iconColor="text-red-600"
            highlight={summary.open_chargebacks > 0}
          />
        </AdminMotion>
      </div>

      {revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <AdminMotion delay={0}>
            <div className={`${AP.card} ${AP.cardPadding} ${AP.cardHover}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Total GMV
              </p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {Number(revenue.total_gmv ?? 0).toLocaleString()}
              </p>
            </div>
          </AdminMotion>
          <AdminMotion delay={60}>
            <div className={`${AP.card} ${AP.cardPadding} ${AP.cardHover}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Commission revenue
              </p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">
                {Number(revenue.total_commission_revenue ?? 0).toLocaleString()}
              </p>
            </div>
          </AdminMotion>
          <AdminMotion delay={120}>
            <div className={`${AP.card} ${AP.cardPadding} ${AP.cardHover}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Pending revenue
              </p>
              <p className="text-2xl font-bold text-amber-600 tabular-nums">
                {Number(revenue.pending_revenue ?? 0).toLocaleString()}
              </p>
            </div>
          </AdminMotion>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <AdminMotion delay={0}>
          <AdminBarChart title="Orders by status" data={summary.orders_by_status} />
        </AdminMotion>
        <AdminMotion delay={80}>
          <AdminDonutChart title="Payouts by status" data={summary.payouts_by_status} />
        </AdminMotion>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <CurrencyBreakdown title="GMV by currency" data={summary.gmv_by_currency} delay={0} />
        <CurrencyBreakdown
          title="Escrow held (seller net)"
          data={summary.escrow_by_currency}
          delay={60}
        />
        <CurrencyBreakdown
          title="Refunds by currency"
          data={summary.refunds_by_currency}
          delay={120}
        />
      </div>

      <AdminMotion delay={100}>
        <AdminTableCard
          title={
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-600" aria-hidden="true" />
              Recent orders
            </span>
          }
          action={
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View all →
            </Link>
          }
        >
          {summary.recent_orders.length === 0 ? (
            <AdminEmptyState
              icon={Inbox}
              title="No recent orders"
              description="Orders will appear here as they come in."
              action={
                <Link href="/admin/orders" className={AP.btnSecondary}>
                  Browse all orders
                </Link>
              }
            />
          ) : (
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>Order</AdminTableHeadCell>
                  <AdminTableHeadCell>Amount</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Escrow</AdminTableHeadCell>
                  <AdminTableHeadCell>Payout</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {summary.recent_orders.map((order) => (
                    <AdminTableRow key={order.id}>
                      <AdminTableCell>
                        <Link
                          href={`/my-orders/${order.id}`}
                          className="text-primary-600 hover:text-primary-700 font-mono text-xs font-medium transition-colors"
                        >
                          {order.id.slice(0, 8)}…
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell className="tabular-nums whitespace-nowrap">
                        {order.currency} {Number(order.total_amount).toLocaleString()}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={order.status} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={order.escrow_status} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={order.payout_status} />
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </table>
            </div>
          )}
        </AdminTableCard>
      </AdminMotion>
    </div>
  );
}
