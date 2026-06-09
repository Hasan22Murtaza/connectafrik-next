"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Shield,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { AdminErrorState } from "@/features/admin/components/AdminErrorState";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  AdminOrderDetail,
  getAdminOrder,
  issueOrderRefund,
} from "@/features/marketplace/services/adminService";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function formatMoney(currency: string, amount: number | null | undefined) {
  if (amount == null) return "—";
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function PartyCard({
  title,
  party,
  email,
  phone,
}: {
  title: string;
  party?: AdminOrderDetail["buyer"];
  email?: string | null;
  phone?: string | null;
}) {
  return (
    <div className={`${AP.card} ${AP.cardPadding}`}>
      <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <User className="w-4 h-4 text-primary-600" aria-hidden="true" />
        {title}
      </h2>
      {party ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {party.avatar_url ? (
              <img
                src={party.avatar_url}
                alt={party.full_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-600">
                  {party.full_name?.charAt(0) || "?"}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {party.full_name || party.username}
              </p>
              <Link
                href={`/user/${party.username}`}
                target="_blank"
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                @{party.username}
              </Link>
            </div>
          </div>
          {email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{phone}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Not available</p>
      )}
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const { isReady, authLoading } = useAdminAuth("/admin/orders");

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [markCancelled, setMarkCancelled] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(false);
      const data = await getAdminOrder(orderId);
      setOrder(data);
    } catch {
      setError(true);
      setOrder(null);
      toast.error("Unable to load order — admin access required");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!isReady || !orderId) return;
    loadOrder();
  }, [isReady, orderId, loadOrder]);

  const handleRefund = async () => {
    if (!order) return;

    setRefunding(true);
    try {
      await issueOrderRefund(order.id, {
        amount: refundAmount ? Number(refundAmount) : undefined,
        reason: refundReason.trim() || "Admin refund",
        mark_cancelled: markCancelled,
      });
      toast.success("Refund issued");
      setShowRefund(false);
      setRefundAmount("");
      setRefundReason("");
      setMarkCancelled(false);
      await loadOrder();
    } catch {
      toast.error("Failed to issue refund");
    } finally {
      setRefunding(false);
    }
  };

  if (authLoading || !isReady) {
    return <AdminLoading variant="order-detail" />;
  }

  if (loading) {
    return <AdminLoading variant="order-detail" />;
  }

  if (error || !order) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to orders
        </Link>
        <div className={AP.card}>
          <AdminErrorState
            title="Order not found"
            message="This order may have been removed or you may not have access."
            onRetry={loadOrder}
          />
        </div>
      </div>
    );
  }

  const dispute = order.dispute as {
    id?: string;
    status?: string;
    reason?: string;
    description?: string;
    created_at?: string;
  } | null;

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to orders
      </Link>

      <AdminPageHeader
        title={`Order #${order.order_number || order.id.slice(0, 8)}`}
        description={order.product_title}
        icon={Package}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={loadOrder}
              disabled={loading}
              className={AP.btnSecondary}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Refresh
            </button>
            <Link
              href={`/my-orders/${order.id}`}
              target="_blank"
              className={AP.btnSecondary}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Buyer view
            </Link>
            <button
              type="button"
              onClick={() => setShowRefund(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 active:scale-[0.98] transition-all duration-200"
            >
              Issue refund
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <AdminStatusBadge status={order.status} />
        <AdminStatusBadge status={order.payment_status} />
        {order.escrow_status && <AdminStatusBadge status={order.escrow_status} />}
        {order.payout_status && <AdminStatusBadge status={order.payout_status} />}
        {order.refund_status && order.refund_status !== "none" && (
          <AdminStatusBadge status={order.refund_status} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary-600" aria-hidden="true" />
              Product
            </h2>
            <div className="flex gap-4">
              {order.product_image ? (
                <img
                  src={order.product_image}
                  alt={order.product_title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-gray-400" aria-hidden="true" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-2">{order.product_title}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    Quantity:{" "}
                    <span className="font-medium text-gray-900">{order.quantity}</span>
                  </p>
                  <p>
                    Unit price:{" "}
                    <span className="font-medium text-gray-900">
                      {formatMoney(order.currency, order.unit_price)}
                    </span>
                  </p>
                  <p>
                    Total:{" "}
                    <span className="font-semibold text-primary-600">
                      {formatMoney(order.currency, order.total_amount)}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/marketplace/${order.product_id}`}
                  target="_blank"
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-2 inline-block"
                >
                  View product →
                </Link>
              </div>
            </div>
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary-600" aria-hidden="true" />
              Payment
            </h2>
            <DetailRow label="Payment status" value={<AdminStatusBadge status={order.payment_status} />} />
            <DetailRow
              label="Method"
              value={order.payment_method || order.payment_gateway || "—"}
            />
            {order.payment_reference && (
              <DetailRow
                label="Reference"
                value={<span className="font-mono text-xs">{order.payment_reference}</span>}
              />
            )}
            <DetailRow label="Paid at" value={formatDate(order.paid_at)} />
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary-600" aria-hidden="true" />
              Delivery
            </h2>
            <DetailRow
              label="Delivery status"
              value={<span className="capitalize">{order.delivery_status || "—"}</span>}
            />
            <DetailRow label="Confirmed at" value={formatDate(order.delivery_confirmed_at)} />
            {order.shipping_address ? (
              <div className="pt-2">
                <p className="text-sm text-gray-500 mb-1.5">Shipping address</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-900 space-y-0.5">
                  {order.shipping_address.street && <p>{order.shipping_address.street}</p>}
                  <p>
                    {[
                      order.shipping_address.city,
                      order.shipping_address.state,
                      order.shipping_address.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {order.shipping_address.country && <p>{order.shipping_address.country}</p>}
                </div>
              </div>
            ) : (
              <DetailRow label="Shipping address" value="Not provided" />
            )}
          </div>

          {(order.platform_commission_amount != null || order.seller_net_amount != null) && (
            <div className={`${AP.card} ${AP.cardPadding}`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Financial breakdown</h2>
              <DetailRow label="Order total" value={formatMoney(order.currency, order.total_amount)} />
              {order.platform_commission_amount != null && (
                <DetailRow
                  label={`Commission${order.platform_commission_rate != null ? ` (${(Number(order.platform_commission_rate) * 100).toFixed(1)}%)` : ""}`}
                  value={formatMoney(order.currency, order.platform_commission_amount)}
                />
              )}
              {order.gateway_fee_total != null && (
                <DetailRow
                  label="Gateway fees"
                  value={formatMoney(order.currency, order.gateway_fee_total)}
                />
              )}
              {order.seller_net_amount != null && (
                <DetailRow
                  label="Seller net"
                  value={formatMoney(order.currency, order.seller_net_amount)}
                />
              )}
              <DetailRow label="Escrow" value={<AdminStatusBadge status={order.escrow_status} />} />
              <DetailRow label="Payout" value={<AdminStatusBadge status={order.payout_status} />} />
              <DetailRow label="Paid to seller" value={formatDate(order.paid_to_seller_at)} />
              <DetailRow label="Release eligible" value={formatDate(order.release_eligible_at)} />
            </div>
          )}

          {dispute && (
            <div className={`${AP.card} ${AP.cardPadding}`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-600" aria-hidden="true" />
                Dispute
              </h2>
              <DetailRow label="Status" value={<AdminStatusBadge status={dispute.status} />} />
              <DetailRow label="Reason" value={<span className="capitalize">{dispute.reason?.replace(/_/g, " ")}</span>} />
              {dispute.description && (
                <p className="text-sm text-gray-700 mt-2 bg-orange-50 rounded-lg p-3">
                  {dispute.description}
                </p>
              )}
              <DetailRow label="Opened" value={formatDate(dispute.created_at)} />
              {dispute.id && (
                <Link
                  href={`/admin/disputes`}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-2 inline-block"
                >
                  Manage in disputes →
                </Link>
              )}
            </div>
          )}

          {(order.refunds.length > 0 ||
            (order.refunded_amount ?? 0) > 0 ||
            order.cancelled_at) && (
            <div className={`${AP.card} ${AP.cardPadding}`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Refunds & cancellation</h2>
              {order.refund_status && order.refund_status !== "none" && (
                <DetailRow
                  label="Refund status"
                  value={<span className="capitalize">{order.refund_status}</span>}
                />
              )}
              {(order.refunded_amount ?? 0) > 0 && (
                <DetailRow
                  label="Refunded amount"
                  value={formatMoney(order.currency, order.refunded_amount)}
                />
              )}
              {order.cancellation_reason && (
                <DetailRow label="Cancellation reason" value={order.cancellation_reason} />
              )}
              {order.cancelled_at && (
                <DetailRow label="Cancelled at" value={formatDate(order.cancelled_at)} />
              )}
              {order.refunds.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Refund history
                  </p>
                  {order.refunds.map((refund) => {
                    const r = refund as {
                      id: string;
                      amount: number;
                      currency: string;
                      status: string;
                      reason?: string;
                      created_at: string;
                    };
                    return (
                      <div
                        key={r.id}
                        className="flex justify-between gap-2 text-sm bg-gray-50 rounded-lg p-3"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatMoney(r.currency, r.amount)}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{r.status}</p>
                          {r.reason && <p className="text-xs text-gray-500">{r.reason}</p>}
                        </div>
                        <p className="text-xs text-gray-500 shrink-0">{formatDate(r.created_at)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {order.notes && (
            <div className={`${AP.card} ${AP.cardPadding}`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Buyer notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h2>
            <DetailRow label="Placed" value={formatDate(order.created_at)} />
            <DetailRow label="Last updated" value={formatDate(order.updated_at)} />
            <DetailRow label="Paid" value={formatDate(order.paid_at)} />
            <DetailRow label="Delivery confirmed" value={formatDate(order.delivery_confirmed_at)} />
          </div>

          <PartyCard
            title="Buyer"
            party={order.buyer}
            email={order.buyer_email}
            phone={order.buyer_phone}
          />

          <PartyCard title="Seller" party={order.seller} />

          {order.payouts.length > 0 && (
            <div className={`${AP.card} ${AP.cardPadding}`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Payouts</h2>
              <div className="space-y-2">
                {order.payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="text-sm bg-gray-50 rounded-lg p-3 space-y-1"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-900">
                        {formatMoney(payout.currency || order.currency, payout.amount)}
                      </span>
                      <AdminStatusBadge status={payout.status} />
                    </div>
                    <p className="text-xs text-gray-500 capitalize">
                      {payout.payout_method}
                      {payout.gateway ? ` · ${payout.gateway}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(payout.created_at)}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/admin/payouts"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-3 inline-block"
              >
                View all payouts →
              </Link>
            </div>
          )}
        </div>
      </div>

      {showRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${AP.card} shadow-2xl w-full max-w-md p-6`}>
            <h2 className="font-semibold text-lg mb-1">Issue refund</h2>
            <p className="text-sm text-gray-500 mb-4">
              {order.product_title} · {formatMoney(order.currency, order.total_amount)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
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
                onClick={() => setShowRefund(false)}
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
