"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Inbox, RefreshCw, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import {
  AdminTableBody,
  AdminTableCard,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminTableSkeleton } from "@/features/admin/components/skeletons/AdminShimmerLoaders";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import {
  AdminPayout,
  listAdminPayouts,
} from "@/features/marketplace/services/adminService";
import {
  getPendingPayouts,
  processSellerPayout,
} from "@/features/marketplace/services/commissionService";

const PAYOUT_STATUSES = [
  "",
  "pending",
  "approved",
  "processing",
  "completed",
  "failed",
  "cancelled",
];

export default function AdminPayoutsPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/payouts");
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [pendingQueue, setPendingQueue] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [processId, setProcessId] = useState<string | null>(null);
  const [payoutReference, setPayoutReference] = useState("");
  const [processNotes, setProcessNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const limit = 20;

  const loadPayouts = useCallback(async () => {
    try {
      setLoading(true);
      const [result, pending] = await Promise.all([
        listAdminPayouts({
          status: statusFilter || undefined,
          page,
          limit,
        }),
        getPendingPayouts(),
      ]);
      setPayouts(result.data);
      setTotal(result.count);
      setPendingQueue(pending as AdminPayout[]);
    } catch {
      toast.error("Unable to load payouts — admin access required");
      setPayouts([]);
      setPendingQueue([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    if (!isReady) return;
    loadPayouts();
  }, [isReady, loadPayouts]);

  const handleProcess = async () => {
    if (!processId || !payoutReference.trim()) {
      toast.error("Payout reference is required");
      return;
    }

    setProcessing(true);
    try {
      await processSellerPayout(
        processId,
        payoutReference.trim(),
        processNotes.trim() || undefined
      );
      toast.success("Payout processed");
      setProcessId(null);
      setPayoutReference("");
      setProcessNotes("");
      await loadPayouts();
    } catch {
      toast.error("Failed to process payout");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || !isReady) {
    return <AdminLoading variant="payouts" />;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Payouts"
        description="Review pending seller payouts and process transfers across all gateways."
        icon={Wallet}
        action={
          <button
            type="button"
            onClick={loadPayouts}
            disabled={loading}
            className={AP.btnSecondary}
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        }
      />

      {pendingQueue.length > 0 && (
        <AdminTableCard
          title={`Pending queue (${pendingQueue.length})`}
          highlight
        >
          <div className={AP.tableWrap}>
            <table className={AP.table}>
              <AdminTableHead>
                <AdminTableHeadCell>Seller</AdminTableHeadCell>
                <AdminTableHeadCell>Order</AdminTableHeadCell>
                <AdminTableHeadCell>Amount</AdminTableHeadCell>
                <AdminTableHeadCell>Method</AdminTableHeadCell>
                <AdminTableHeadCell>Requested</AdminTableHeadCell>
                <AdminTableHeadCell>Action</AdminTableHeadCell>
              </AdminTableHead>
              <AdminTableBody>
                {pendingQueue.map((payout) => (
                  <AdminTableRow key={payout.id}>
                    <AdminTableCell className="font-mono text-xs">
                      {payout.seller_id.slice(0, 8)}…
                    </AdminTableCell>
                    <AdminTableCell>
                      <Link
                        href={`/my-orders/${payout.order_id}`}
                        target="_blank"
                        className="text-primary-600 hover:text-primary-700 font-mono text-xs flex items-center gap-0.5 font-medium transition-colors"
                      >
                        {payout.order_id.slice(0, 8)}…
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap tabular-nums">
                      {payout.currency || "—"}{" "}
                      {Number(payout.amount).toLocaleString()}
                    </AdminTableCell>
                    <AdminTableCell className="capitalize">
                      {payout.payout_method?.replace(/_/g, " ") || "—"}
                    </AdminTableCell>
                    <AdminTableCell className="text-gray-500">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </AdminTableCell>
                    <AdminTableCell>
                      <button
                        type="button"
                        onClick={() => setProcessId(payout.id)}
                        className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                      >
                        Process
                      </button>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </table>
          </div>
        </AdminTableCard>
      )}

      <div className={`${AP.card} ${AP.cardPadding} mb-4 flex flex-wrap gap-3 items-end ${pendingQueue.length > 0 ? "mt-6" : ""}`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Payout status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className={MP.selectInput}
          >
            <option value="">All statuses</option>
            {PAYOUT_STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-gray-500">
          {total} payout{total !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={8} cols={9} />
      ) : (
        <div className={`${AP.card} overflow-hidden`}>
          {payouts.length === 0 ? (
            <AdminEmptyState
              icon={Inbox}
              title="No payouts found"
              description="Payout records will appear here once sellers request transfers."
            />
          ) : (
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>ID</AdminTableHeadCell>
                  <AdminTableHeadCell>Seller</AdminTableHeadCell>
                  <AdminTableHeadCell>Order</AdminTableHeadCell>
                  <AdminTableHeadCell>Amount</AdminTableHeadCell>
                  <AdminTableHeadCell>Commission</AdminTableHeadCell>
                  <AdminTableHeadCell>Gateway</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Date</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {payouts.map((payout) => (
                    <AdminTableRow key={payout.id}>
                      <AdminTableCell className="font-mono text-xs">
                        {payout.id.slice(0, 8)}…
                      </AdminTableCell>
                      <AdminTableCell className="font-mono text-xs">
                        {payout.seller_id.slice(0, 8)}…
                      </AdminTableCell>
                      <AdminTableCell>
                        <Link
                          href={`/my-orders/${payout.order_id}`}
                          target="_blank"
                          className="text-primary-600 hover:text-primary-700 font-mono text-xs font-medium transition-colors"
                        >
                          {payout.order_id.slice(0, 8)}…
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap tabular-nums">
                        {payout.currency || "—"}{" "}
                        {Number(payout.amount).toLocaleString()}
                      </AdminTableCell>
                      <AdminTableCell className="tabular-nums">
                        {payout.commission_amount != null
                          ? Number(payout.commission_amount).toLocaleString()
                          : "—"}
                      </AdminTableCell>
                      <AdminTableCell className="capitalize">
                        {payout.gateway || "—"}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={payout.status} />
                      </AdminTableCell>
                      <AdminTableCell className="text-gray-500">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </AdminTableCell>
                      <AdminTableCell>
                        {payout.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => setProcessId(payout.id)}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                          >
                            Process
                          </button>
                        )}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </table>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className={AP.btnSecondary}
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className={AP.btnSecondary}
          >
            Next
          </button>
        </div>
      )}

      {processId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${AP.card} shadow-2xl w-full max-w-md p-6`}>
            <h2 className="font-semibold text-lg mb-4">Process payout</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payout reference *
                </label>
                <input
                  type="text"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  placeholder="Bank transfer ref, Stripe payout ID, etc."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={processNotes}
                  onChange={(e) => setProcessNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleProcess}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {processing ? "Processing..." : "Mark as completed"}
              </button>
              <button
                type="button"
                onClick={() => setProcessId(null)}
                className={AP.btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
