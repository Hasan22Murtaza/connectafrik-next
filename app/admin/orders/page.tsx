"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Package, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import {
  AdminOrder,
  issueOrderRefund,
  listAdminOrders,
} from "@/features/marketplace/services/adminService";

const ORDER_STATUSES = [
  "",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
];

const ESCROW_STATUSES = ["", "held", "scheduled", "frozen", "released"];

export default function AdminOrdersPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/orders");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [escrowFilter, setEscrowFilter] = useState("");
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [markCancelled, setMarkCancelled] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const limit = 20;

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listAdminOrders({
        status: statusFilter || undefined,
        escrow_status: escrowFilter || undefined,
        page,
        limit,
      });
      setOrders(result.data);
      setTotal(result.count);
    } catch {
      toast.error("Unable to load orders — admin access required");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, escrowFilter, page]);

  useEffect(() => {
    if (!isReady) return;
    loadOrders();
  }, [isReady, loadOrders]);

  const selectedOrder = orders.find((o) => o.id === refundOrderId);

  const handleRefund = async () => {
    if (!refundOrderId) return;

    setRefunding(true);
    try {
      await issueOrderRefund(refundOrderId, {
        amount: refundAmount ? Number(refundAmount) : undefined,
        reason: refundReason.trim() || "Admin refund",
        mark_cancelled: markCancelled,
      });
      toast.success("Refund issued");
      setRefundOrderId(null);
      setRefundAmount("");
      setRefundReason("");
      setMarkCancelled(false);
      await loadOrders();
    } catch {
      toast.error("Failed to issue refund");
    } finally {
      setRefunding(false);
    }
  };

  if (authLoading || !isReady) {
    return <AdminLoading message="Loading orders..." />;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Orders"
        description="View all marketplace orders, monitor escrow and payout status, and issue refunds."
        icon={Package}
        action={
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className={`${MP.card} ${MP.cardPadding} mb-4 flex flex-wrap gap-3`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Order status
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
            {ORDER_STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Escrow status
          </label>
          <select
            value={escrowFilter}
            onChange={(e) => {
              setEscrowFilter(e.target.value);
              setPage(0);
            }}
            className={MP.selectInput}
          >
            <option value="">All escrow</option>
            {ESCROW_STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <p className="text-sm text-gray-500">
            {total} order{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className={`${MP.card} overflow-hidden`}>
        {loading ? (
          <AdminLoading message="Loading orders..." />
        ) : orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No orders found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Escrow</th>
                  <th className="px-4 py-2.5">Payout</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {order.order_number || order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px] truncate">
                      {order.product_title}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {order.currency}{" "}
                      {Number(order.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminStatusBadge status={order.escrow_status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminStatusBadge status={order.payout_status} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/my-orders/${order.id}`}
                          target="_blank"
                          className="text-primary-600 hover:underline text-xs flex items-center gap-0.5"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRefundOrderId(order.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Refund
                        </button>
                      </div>
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

      {refundOrderId && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border shadow-lg w-full max-w-md p-6">
            <h2 className="font-semibold text-lg mb-1">Issue refund</h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedOrder.product_title} · {selectedOrder.currency}{" "}
              {Number(selectedOrder.total_amount).toLocaleString()}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (leave empty for full refund)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Admin refund"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={markCancelled}
                  onChange={(e) => setMarkCancelled(e.target.checked)}
                />
                Mark order as cancelled
              </label>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleRefund}
                disabled={refunding}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {refunding ? "Processing..." : "Issue refund"}
              </button>
              <button
                type="button"
                onClick={() => setRefundOrderId(null)}
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
