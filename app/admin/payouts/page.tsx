"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
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
    return <AdminLoading message="Loading payouts..." />;
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
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {pendingQueue.length > 0 && (
        <div className={`${MP.card} overflow-hidden mb-6`}>
          <div className="px-4 py-3 border-b bg-amber-50 font-medium text-sm text-amber-800">
            Pending queue ({pendingQueue.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-4 py-2">Seller</th>
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Requested</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingQueue.map((payout) => (
                  <tr key={payout.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">
                      {payout.seller_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/my-orders/${payout.order_id}`}
                        target="_blank"
                        className="text-primary-600 hover:underline font-mono text-xs flex items-center gap-0.5"
                      >
                        {payout.order_id.slice(0, 8)}…
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {payout.currency || "—"}{" "}
                      {Number(payout.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 capitalize">
                      {payout.payout_method?.replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setProcessId(payout.id)}
                        className="text-xs font-medium text-green-700 hover:underline"
                      >
                        Process
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`${MP.card} ${MP.cardPadding} mb-4 flex flex-wrap gap-3 items-end`}>
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

      <div className={`${MP.card} overflow-hidden`}>
        {loading ? (
          <AdminLoading message="Loading payouts..." />
        ) : payouts.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No payouts found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Seller</th>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Commission</th>
                  <th className="px-4 py-2.5">Gateway</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {payout.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {payout.seller_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/my-orders/${payout.order_id}`}
                        target="_blank"
                        className="text-primary-600 hover:underline font-mono text-xs"
                      >
                        {payout.order_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {payout.currency || "—"}{" "}
                      {Number(payout.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      {payout.commission_amount != null
                        ? Number(payout.commission_amount).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 capitalize">
                      {payout.gateway || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminStatusBadge status={payout.status} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(payout.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      {payout.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => setProcessId(payout.id)}
                          className="text-xs font-medium text-green-700 hover:underline"
                        >
                          Process
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
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
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {processId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border shadow-lg w-full max-w-md p-6">
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
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Mark as completed"}
              </button>
              <button
                type="button"
                onClick={() => setProcessId(null)}
                className="px-4 py-2 border rounded-lg text-sm"
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
