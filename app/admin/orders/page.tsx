"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Inbox, Package, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import {
  AdminTableBody,
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

const ESCROW_STATUSES = ["", "held", "scheduled", "frozen", "released", "refunded"];

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
    return <AdminLoading variant="orders" />;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Orders"
        icon={Package}
        action={
          <button
            type="button"
            onClick={loadOrders}
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

      <div className={`${AP.card} ${AP.cardPadding} mb-4 flex flex-wrap gap-3`}>
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

      {loading ? (
        <AdminTableSkeleton rows={8} cols={8} />
      ) : (
        <div className={`${AP.card} overflow-hidden`}>
          {orders.length === 0 ? (
            <AdminEmptyState
              icon={Inbox}
              title="No orders found"
              description="Try adjusting your filters or check back later."
            />
          ) : (
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <AdminTableHeadCell>Order</AdminTableHeadCell>
                  <AdminTableHeadCell>Product</AdminTableHeadCell>
                  <AdminTableHeadCell>Amount</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  {/* <AdminTableHeadCell>Escrow</AdminTableHeadCell> */}
                  <AdminTableHeadCell>Payout</AdminTableHeadCell>
                  <AdminTableHeadCell>Date</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {orders.map((order) => (
                    <AdminTableRow key={order.id}>
                      <AdminTableCell className="font-mono text-xs">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                        >
                          {order.order_number || order.id.slice(0, 8)}
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[180px] truncate">
                        {order.product_title}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap tabular-nums">
                        {order.currency}{" "}
                        {Number(order.total_amount).toLocaleString()}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={order.status} />
                      </AdminTableCell>
                      {/* <AdminTableCell>
                        <AdminStatusBadge status={order.escrow_status} />
                      </AdminTableCell> */}
                      <AdminTableCell>
                        <AdminStatusBadge status={order.payout_status} />
                      </AdminTableCell>
                      <AdminTableCell className="text-gray-500 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-primary-600 hover:text-primary-700 text-xs flex items-center gap-0.5 font-medium transition-colors"
                          >
                            View <Eye className="w-3 h-3" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setRefundOrderId(order.id)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                          >
                            Refund
                          </button>
                        </div>
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

      {refundOrderId && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${AP.card} shadow-2xl w-full max-w-md p-6`}>
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
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {refunding ? "Processing..." : "Issue refund"}
              </button>
              <button
                type="button"
                onClick={() => setRefundOrderId(null)}
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
