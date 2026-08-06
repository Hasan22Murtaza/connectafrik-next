"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import CancelOrderModal from "@/features/marketplace/components/CancelOrderModal";
import ConfirmDeliveryModal from "@/features/marketplace/components/ConfirmDeliveryModal";
import OpenDisputeModal from "@/features/marketplace/components/OpenDisputeModal";
import {
  Dispute,
  getOrderDispute,
} from "@/features/marketplace/services/disputeService";
import { startMarketplaceConversation } from "@/features/marketplace/services/marketplaceInboxService";
import {
  getOrderRefunds,
  RefundTransaction,
} from "@/features/marketplace/services/refundService";
import { buildMarketplaceSeedThread } from "@/features/marketplace/utils/marketplaceChatThread";
import { apiClient } from "@/lib/api-client";
import {
  getNextOrderStatuses,
  getOrderDisplayLabelText,
  getSellerStatusHint,
  getSellerTransitionLabel,
} from "@/lib/marketplace/orderStatus";
import { OrderDetailPageShimmer } from "@/shared/components/ui/ShimmerLoaders";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Flag,
  Mail,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
  Shield,
  ShoppingBag,
  Truck,
  XCircle,
} from "@/shared/icons";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface OrderDetail {
  id: string;
  order_number: string;
  product_id: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  delivery_status: string;
  status: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  shipping_address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  payout_status: string | null;
  paid_to_seller_at: string | null;
  escrow_status: string | null;
  release_eligible_at: string | null;
  release_scheduled_at: string | null;
  delivery_confirmed_at: string | null;
  refunded_amount: number | null;
  refund_status: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  seller?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
  };
  buyer?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
  };
}

type TimelineStep = {
  key: string;
  label: string;
  date: string | null;
  done: boolean;
  current: boolean;
  Icon: React.ComponentType<{ className?: string }>;
};

function buildTimeline(order: OrderDetail): TimelineStep[] {
  const status = (order.status || "").toLowerCase();
  const paid = order.payment_status === "completed";
  const processingDone = [
    "processing",
    "confirmed",
    "shipped",
    "delivered",
    "completed",
  ].includes(status);
  const shippedDone = ["shipped", "delivered", "completed"].includes(status);
  const deliveredDone = ["delivered", "completed"].includes(status);

  let currentKey = "placed";
  if (status === "cancelled" || status === "refunded") currentKey = status;
  else if (deliveredDone) currentKey = "delivered";
  else if (shippedDone) currentKey = "shipped";
  else if (processingDone) currentKey = "processing";
  else if (paid) currentKey = "paid";

  const steps: TimelineStep[] = [
    {
      key: "placed",
      label: "Order Placed",
      date: order.created_at,
      done: true,
      current: currentKey === "placed",
      Icon: ShoppingBag,
    },
    {
      key: "paid",
      label: "Payment Confirmed",
      date: order.paid_at,
      done: paid || processingDone || shippedDone || deliveredDone,
      current: currentKey === "paid",
      Icon: CreditCard,
    },
    {
      key: "processing",
      label: "Preparing Shipment",
      date: null,
      done: processingDone || shippedDone || deliveredDone,
      current: currentKey === "processing",
      Icon: Package,
    },
    {
      key: "shipped",
      label: "Shipped",
      date: null,
      done: shippedDone || deliveredDone,
      current: currentKey === "shipped",
      Icon: Truck,
    },
    {
      key: "delivered",
      label: "Delivered",
      date: order.delivery_confirmed_at,
      done: deliveredDone,
      current: currentKey === "delivered",
      Icon: CheckCircle,
    },
  ];

  if (status === "cancelled") {
    return [
      steps[0],
      {
        key: "cancelled",
        label: "Cancelled",
        date: order.cancelled_at,
        done: true,
        current: true,
        Icon: XCircle,
      },
    ];
  }

  if (status === "refunded") {
    return [
      steps[0],
      {
        key: "refunded",
        label: "Refunded",
        date: order.updated_at,
        done: true,
        current: true,
        Icon: XCircle,
      },
    ];
  }

  return steps;
}

const OrderDetailPage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  const { openThread } = useProductionChat();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBuyer, setIsBuyer] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [showConfirmDelivery, setShowConfirmDelivery] = useState(false);
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [showOpenDispute, setShowOpenDispute] = useState(false);
  const [refunds, setRefunds] = useState<RefundTransaction[]>([]);
  const [dispute, setDispute] = useState<Dispute | null>(null);

  useEffect(() => {
    if (user && orderId) {
      fetchOrderDetails();
    }
  }, [user, orderId]);

  const fetchOrderDetails = async () => {
    if (!user || !orderId) return;

    try {
      setLoading(true);

      const res = await apiClient.get<{
        data: OrderDetail & { isBuyer: boolean; isSeller: boolean };
      }>(`/api/orders/${orderId}`);
      const orderData = res.data;

      if (!orderData) {
        toast.error("Order not found");
        router.push("/my-orders");
        return;
      }

      setIsBuyer(orderData.isBuyer);
      setIsSeller(orderData.isSeller);
      setOrder(orderData);

      try {
        const disputeData = await getOrderDispute(orderId);
        setDispute(disputeData);
      } catch {
        setDispute(null);
      }

      if (
        orderData.refund_status === "partial" ||
        orderData.refund_status === "full" ||
        orderData.status === "refunded" ||
        orderData.status === "cancelled"
      ) {
        try {
          const refundList = await getOrderRefunds(orderId);
          setRefunds(refundList);
        } catch {
          setRefunds([]);
        }
      } else {
        setRefunds([]);
      }
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      if (error.status === 403) {
        toast.error("You are not authorized to view this order");
      } else {
        toast.error("Failed to load order details");
      }
      router.push("/my-orders");
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatusContext = (orderData: OrderDetail) => ({
    status: orderData.status,
    payment_status: orderData.payment_status,
    payment_method: orderData.payment_method,
  });

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      USD: "$",
      GHS: "₵",
      NGN: "₦",
      KES: "KSh",
      ZAR: "R",
      XOF: "CFA",
      XAF: "FCFA",
    };
    return symbols[currency] || currency;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return "N/A";
    return method
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const updateOrderStatus = async (newStatus: string) => {
    if (!order || !user || !isSeller) return;

    if (newStatus === "cancelled") {
      const confirmed = window.confirm(
        "Cancel this order? The buyer will receive a full refund if payment was completed."
      );
      if (!confirmed) return;
    }

    try {
      setIsUpdatingStatus(true);

      await apiClient.patch(`/api/orders/${order.id}/status`, {
        status: newStatus,
        cancellation_reason:
          newStatus === "cancelled" ? "Cancelled by seller" : undefined,
      });

      await fetchOrderDetails();
      toast.success(
        newStatus === "cancelled"
          ? "Order cancelled and refund initiated"
          : `Order updated to ${getOrderDisplayLabelText({
              status: newStatus,
              payment_status: order.payment_status,
              payment_method: order.payment_method,
            })}`
      );
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast.error(error?.message || "Failed to update order status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMessageOtherParty = async () => {
    if (!order || !user) return;

    if (isBuyer && order.product_id) {
      try {
        setContacting(true);
        const result = await startMarketplaceConversation(order.product_id);
        const buyerName =
          (user.user_metadata?.full_name as string | undefined)?.trim() ||
          user.email?.split("@")[0] ||
          "Buyer";
        const buyerAvatar = user.user_metadata?.avatar_url as
          | string
          | undefined;

        const seedThread = buildMarketplaceSeedThread({
          threadId: result.thread_id,
          productId: result.product_id,
          productTitle: result.product_title,
          productImage: result.product_image,
          sellerId: result.seller_id,
          sellerName:
            result.seller?.full_name || order.seller?.full_name || "Seller",
          sellerAvatarUrl:
            result.seller?.avatar_url || order.seller?.avatar_url,
          buyerId: user.id,
          buyerName,
          buyerAvatarUrl: buyerAvatar,
        });

        openThread(result.thread_id, seedThread);
        router.push(`/chat/${encodeURIComponent(result.thread_id)}`);
      } catch (error) {
        console.error("Error starting marketplace chat:", error);
        toast.error("Failed to start chat");
      } finally {
        setContacting(false);
      }
      return;
    }

    const otherId = isBuyer ? order.seller?.id : order.buyer?.id;
    if (otherId) {
      router.push(`/user/${otherId}`);
    } else {
      toast.error("Contact information not available");
    }
  };

  if (loading) {
    return <OrderDetailPageShimmer />;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-content-secondary mb-4">Order not found</p>
          <button
            onClick={() => router.push("/my-orders")}
            className="btn-primary"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const otherParty = isBuyer ? order.seller : order.buyer;
  const timeline = buildTimeline(order);
  const displayStatus = getOrderDisplayLabelText(getOrderStatusContext(order));

  const canConfirmDelivery =
    isBuyer &&
    order.payment_status === "completed" &&
    order.payout_status !== "completed" &&
    !order.paid_to_seller_at &&
    order.escrow_status !== "scheduled" &&
    order.escrow_status !== "released" &&
    order.escrow_status !== "frozen" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    !dispute &&
    (order.status === "shipped" ||
      order.delivery_status === "shipped" ||
      order.status === "completed");

  const canOpenDispute =
    isBuyer &&
    order.payment_status === "completed" &&
    order.payout_status !== "completed" &&
    !dispute &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    ["confirmed", "processing", "shipped", "completed"].includes(order.status);

  const activeDisputeStatuses = ["open", "awaiting_seller", "under_review"];
  const hasActiveDispute =
    dispute && activeDisputeStatuses.includes(dispute.status);

  const canCancelOrder =
    (isBuyer || isSeller) &&
    order.payment_status === "completed" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    order.refund_status !== "full" &&
    ["pending", "confirmed", "processing"].includes(order.status);

  const nextStatuses =
    isSeller &&
    order.status !== "completed" &&
    order.status !== "cancelled" &&
    order.status !== "refunded"
      ? getNextOrderStatuses(order.status)
      : [];

  return (
    <div className="min-h-screen bg-surface-canvas pb-24 sm:pb-8">
      <div className="w-full max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <button
          type="button"
          onClick={() => router.push("/my-orders")}
          className="inline-flex items-center gap-1.5 text-sm text-content-secondary hover:text-content transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
          {/* Main panel */}
          <div className="lg:col-span-8">
            <div className="bg-surface rounded-2xl shadow-sm ring-1 ring-border-subtle overflow-hidden">
              {/* Product header */}
              <div className="p-4 sm:p-6 flex items-start gap-3.5 sm:gap-4">
                <Link
                  href={`/marketplace/${order.product_id}`}
                  className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-surface-secondary shrink-0 ring-1 ring-black/5"
                >
                  {order.product_image ? (
                    <img
                      src={order.product_image}
                      alt={order.product_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-7 h-7 text-content-tertiary" />
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <h1 className="font-semibold text-content text-base sm:text-xl leading-snug">
                    {order.product_title}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                    <span className="font-bold text-content text-base">
                      {getCurrencySymbol(order.currency)}
                      {order.total_amount.toLocaleString()}
                    </span>
                    <span className="text-content-tertiary">·</span>
                    <span className="text-content-secondary">
                      Qty {order.quantity}
                    </span>
                    <span className="text-content-tertiary">·</span>
                    <span className="text-content-tertiary text-xs sm:text-sm">
                      {getCurrencySymbol(order.currency)}
                      {order.unit_price.toLocaleString()} each
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-content-tertiary font-mono">
                    #{order.order_number}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="px-4 sm:px-6 pb-5 sm:pb-6 border-t border-border-subtle pt-5">
                <h2 className="text-sm font-semibold text-content mb-4">
                  Order progress
                </h2>
                <ol className="relative">
                  {timeline.map((step, index) => {
                    const isLast = index === timeline.length - 1;
                    const isNegative =
                      step.key === "cancelled" || step.key === "refunded";
                    const StepIcon = step.Icon;
                    return (
                      <li
                        key={step.key}
                        className="relative flex gap-3.5 pb-5 last:pb-0"
                      >
                        {!isLast && (
                          <div
                            className={`absolute left-[13px] top-7 bottom-0 w-px ${
                              step.done && !isNegative
                                ? "bg-primary-400"
                                : isNegative
                                  ? "bg-red-300"
                                  : "bg-border"
                            }`}
                          />
                        )}
                        <div
                          className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            step.done
                              ? isNegative
                                ? "bg-red-500 text-white"
                                : "bg-primary-600 text-white"
                              : step.current
                                ? "bg-primary-50 ring-2 ring-primary-500 text-primary-700"
                                : "bg-surface-secondary text-content-tertiary"
                          }`}
                        >
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <p
                              className={`text-sm font-medium ${
                                step.done || step.current
                                  ? "text-content"
                                  : "text-content-tertiary"
                              }`}
                            >
                              {step.label}
                            </p>
                            {step.date ? (
                              <p className="text-xs text-content-tertiary shrink-0">
                                {formatDateShort(step.date)}
                              </p>
                            ) : !step.done ? (
                              <p className="text-xs text-content-tertiary shrink-0">
                                Pending
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Payment & Delivery — divided, not separate cards */}
              <div className="border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle">
                <div className="p-4 sm:p-6">
                  <h2 className="text-sm font-semibold text-content mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-content-tertiary" />
                    Payment
                  </h2>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-content-secondary">Status</dt>
                      <dd
                        className={`font-medium ${
                          order.payment_status === "completed"
                            ? "text-green-600"
                            : "text-amber-600"
                        }`}
                      >
                        {order.payment_status === "completed"
                          ? "✓ Paid"
                          : "Pending"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-content-secondary">Method</dt>
                      <dd className="font-medium text-content text-right">
                        {formatPaymentMethod(order.payment_method)}
                      </dd>
                    </div>
                    {order.paid_at && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-content-secondary">Paid on</dt>
                        <dd className="text-content text-right">
                          {formatDateShort(order.paid_at)}
                        </dd>
                      </div>
                    )}
                    {order.payment_reference && (
                      <div>
                        <dt className="text-content-secondary text-xs mb-1">
                          Reference
                        </dt>
                        <dd className="font-mono text-xs text-content break-all bg-surface-secondary/50 rounded-lg px-2.5 py-2">
                          {order.payment_reference}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="p-4 sm:p-6">
                  <h2 className="text-sm font-semibold text-content mb-3 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-content-tertiary" />
                    Delivery
                  </h2>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-content-secondary">Status</dt>
                      <dd className="font-medium text-content capitalize">
                        {order.delivery_status || "Not specified"}
                      </dd>
                    </div>
                    {order.delivery_confirmed_at && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-content-secondary">Confirmed</dt>
                        <dd className="text-content text-right">
                          {formatDateShort(order.delivery_confirmed_at)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {order.shipping_address ? (
                    <div className="mt-3 text-sm text-content space-y-0.5">
                      <p className="text-xs text-content-secondary mb-1">
                        Shipping address
                      </p>
                      {order.shipping_address.street && (
                        <p>{order.shipping_address.street}</p>
                      )}
                      <p>
                        {[
                          order.shipping_address.city,
                          order.shipping_address.state,
                          order.shipping_address.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {order.shipping_address.country && (
                        <p>{order.shipping_address.country}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-content-tertiary">
                      No shipping address provided
                    </p>
                  )}
                </div>
              </div>

              {/* Refund / notes inside same panel */}
              {(order.refund_status === "partial" ||
                order.refund_status === "full" ||
                order.status === "refunded" ||
                order.status === "cancelled") && (
                <div className="border-t border-border-subtle p-4 sm:p-6">
                  <h2 className="text-sm font-semibold text-content mb-3">
                    Refund
                  </h2>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-content-secondary">Status</dt>
                      <dd className="font-medium capitalize text-content">
                        {order.refund_status || order.status}
                      </dd>
                    </div>
                    {(order.refunded_amount ?? 0) > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-content-secondary">Amount</dt>
                        <dd className="font-medium text-content">
                          {getCurrencySymbol(order.currency)}
                          {Number(order.refunded_amount).toLocaleString()}
                        </dd>
                      </div>
                    )}
                    {order.cancellation_reason && (
                      <div>
                        <dt className="text-content-secondary text-xs mb-1">
                          Reason
                        </dt>
                        <dd className="text-content">
                          {order.cancellation_reason}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {refunds.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {refunds.map((refund) => (
                        <div
                          key={refund.id}
                          className="text-sm flex justify-between gap-2 py-2 border-t border-border-subtle first:border-t-0 first:pt-0"
                        >
                          <div>
                            <p className="font-medium text-content">
                              {getCurrencySymbol(refund.currency)}
                              {Number(refund.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-content-secondary capitalize">
                              {refund.status}
                            </p>
                          </div>
                          <p className="text-xs text-content-tertiary">
                            {formatDateShort(refund.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {order.notes && (
                <div className="border-t border-border-subtle p-4 sm:p-6">
                  <h2 className="text-sm font-semibold text-content mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-content-tertiary" />
                    Special instructions
                  </h2>
                  <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Soft alerts below main panel */}
            <div className="mt-4 space-y-2.5">
              {canConfirmDelivery && (
                <div className="rounded-2xl bg-green-50/90 dark:bg-green-950/20 px-4 py-3.5">
                  <p className="text-sm text-content-secondary mb-2.5">
                    Received your order? Confirm delivery to release payment to
                    the seller.
                  </p>
                  <button
                    onClick={() => setShowConfirmDelivery(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirm Delivery
                  </button>
                </div>
              )}

              {isBuyer && order.payout_status === "completed" && (
                <div className="rounded-2xl bg-green-50/90 dark:bg-green-950/20 px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Delivery confirmed — seller payment has been released.
                  </p>
                </div>
              )}

              {isBuyer &&
                order.escrow_status === "scheduled" &&
                order.release_eligible_at && (
                  <div className="rounded-2xl bg-blue-50/90 dark:bg-blue-950/20 px-4 py-3">
                    <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 shrink-0" />
                      Payout scheduled for{" "}
                      {formatDate(order.release_eligible_at)}
                    </p>
                  </div>
                )}

              {canCancelOrder && isBuyer && (
                <div className="rounded-2xl bg-red-50/70 dark:bg-red-950/20 px-4 py-3.5">
                  <p className="text-sm text-content-secondary mb-2.5">
                    Order not shipped yet? You can cancel for a full refund.
                  </p>
                  <button
                    onClick={() => setShowCancelOrder(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-surface text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel Order
                  </button>
                </div>
              )}

              {canOpenDispute && (
                <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3.5">
                  <p className="text-sm text-content-secondary mb-2.5">
                    Having an issue with this order? Open a dispute to freeze
                    seller payout.
                  </p>
                  <button
                    onClick={() => setShowOpenDispute(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-surface text-amber-800 border border-amber-200 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <Shield className="w-4 h-4" />
                    Open Dispute
                  </button>
                </div>
              )}

              {hasActiveDispute && dispute && (
                <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3">
                  <p className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                    <Shield className="w-4 h-4 shrink-0" />
                    {isSeller
                      ? "A buyer opened a dispute on this order. Respond before the deadline."
                      : "Dispute open — seller payout is frozen"}
                  </p>
                  <Link
                    href={`/marketplace/disputes/${dispute.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {isSeller ? "Respond to dispute →" : "View dispute →"}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — single sticky panel */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-20 bg-surface rounded-2xl shadow-sm ring-1 ring-border-subtle overflow-hidden">
              {/* Summary */}
              <div className="p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-content mb-3">
                  Order summary
                </h2>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-content-secondary">Subtotal</dt>
                    <dd className="font-medium text-content">
                      {getCurrencySymbol(order.currency)}
                      {(order.unit_price * order.quantity).toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-content-secondary">Quantity</dt>
                    <dd className="font-medium text-content">{order.quantity}</dd>
                  </div>
                  <div className="flex justify-between items-baseline pt-3 border-t border-border-subtle">
                    <dt className="font-semibold text-content">Total</dt>
                    <dd className="text-lg font-bold text-primary-600">
                      {getCurrencySymbol(order.currency)}
                      {order.total_amount.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Seller / Buyer */}
              <div className="px-4 sm:px-5 py-4 border-t border-border-subtle">
                <h2 className="text-sm font-semibold text-content mb-3">
                  {isBuyer ? "Seller" : "Buyer"}
                </h2>
                {otherParty ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      {otherParty.avatar_url ? (
                        <img
                          src={otherParty.avatar_url}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600">
                            {otherParty.full_name?.charAt(0) || "?"}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-content text-sm truncate">
                          {otherParty.full_name || otherParty.username}
                        </p>
                        <Link
                          href={`/user/${otherParty.id}`}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          @{otherParty.username}
                        </Link>
                      </div>
                    </div>
                    {isBuyer && order.buyer_email && (
                      <div className="flex items-center gap-2 text-xs text-content-secondary">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{order.buyer_email}</span>
                      </div>
                    )}
                    {order.buyer_phone && (
                      <div className="flex items-center gap-2 text-xs text-content-secondary">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{order.buyer_phone}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-content-tertiary">
                    Information not available
                  </p>
                )}
              </div>

              {/* Seller status update */}
              {nextStatuses.length > 0 && (
                <div className="px-4 sm:px-5 py-4 border-t border-border-subtle">
                  <h2 className="text-sm font-semibold text-content mb-1">
                    Update status
                  </h2>
                  <p className="text-xs text-content-secondary mb-3">
                    Current:{" "}
                    <span className="font-medium text-content">
                      {displayStatus}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(status)}
                        disabled={isUpdatingStatus}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                          status === "cancelled"
                            ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            : "bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isUpdatingStatus
                          ? "Updating…"
                          : getSellerTransitionLabel(status)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-content-tertiary mt-2.5">
                    {getSellerStatusHint(order.status)}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="hidden sm:block px-4 sm:px-5 py-4 border-t border-border-subtle bg-surface-secondary/30">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/marketplace/${order.product_id}`}
                    className="inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-content hover:bg-surface transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4 text-content-tertiary" />
                    View Product
                  </Link>
                  <button
                    type="button"
                    onClick={handleMessageOtherParty}
                    disabled={contacting}
                    className="inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-content hover:bg-surface transition-colors text-left disabled:opacity-50"
                  >
                    <MessageCircle className="w-4 h-4 text-content-tertiary" />
                    {contacting
                      ? "Opening…"
                      : isBuyer
                        ? "Message Seller"
                        : "Contact Buyer"}
                  </button>
                  {isBuyer && (
                    <Link
                      href={`/marketplace/${order.product_id}`}
                      className="inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-content hover:bg-surface transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-content-tertiary" />
                      Buy Again
                    </Link>
                  )}
                  {canOpenDispute && (
                    <button
                      type="button"
                      onClick={() => setShowOpenDispute(true)}
                      className="inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors text-left"
                    >
                      <Flag className="w-4 h-4" />
                      Report Issue
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur-md border-t border-border-subtle px-3 py-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <Link
            href={`/marketplace/${order.product_id}`}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-lg bg-surface-secondary text-sm font-medium text-content"
          >
            <ShoppingBag className="w-4 h-4" />
            Product
          </Link>
          <button
            type="button"
            onClick={handleMessageOtherParty}
            disabled={contacting}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-lg bg-primary-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            {isBuyer ? "Message" : "Contact"}
          </button>
          {isBuyer && (
            <Link
              href={`/marketplace/${order.product_id}`}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-lg bg-surface-secondary text-sm font-medium text-content"
            >
              <RotateCcw className="w-4 h-4" />
              Buy Again
            </Link>
          )}
          {canOpenDispute && (
            <button
              type="button"
              onClick={() => setShowOpenDispute(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-lg bg-amber-50 text-amber-800 text-sm font-medium"
            >
              <Flag className="w-4 h-4" />
              Report
            </button>
          )}
          {canConfirmDelivery && (
            <button
              type="button"
              onClick={() => setShowConfirmDelivery(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-lg bg-green-600 text-white text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm
            </button>
          )}
        </div>
      </div>

      {canConfirmDelivery && (
        <ConfirmDeliveryModal
          orderId={order.id}
          orderNumber={order.order_number}
          productTitle={order.product_title}
          sellerName={
            order.seller?.full_name || order.seller?.username || "Seller"
          }
          isOpen={showConfirmDelivery}
          onClose={() => setShowConfirmDelivery(false)}
          onSuccess={fetchOrderDetails}
        />
      )}

      {canCancelOrder && isBuyer && (
        <CancelOrderModal
          orderId={order.id}
          orderNumber={order.order_number}
          productTitle={order.product_title}
          totalAmount={order.total_amount}
          currency={order.currency}
          isOpen={showCancelOrder}
          onClose={() => setShowCancelOrder(false)}
          onSuccess={fetchOrderDetails}
        />
      )}

      {canOpenDispute && (
        <OpenDisputeModal
          orderId={order.id}
          orderNumber={order.order_number}
          productTitle={order.product_title}
          isOpen={showOpenDispute}
          onClose={() => setShowOpenDispute(false)}
          onSuccess={(disputeId) => {
            fetchOrderDetails();
            router.push(`/marketplace/disputes/${disputeId}`);
          }}
        />
      )}
    </div>
  );
};

export default OrderDetailPage;
