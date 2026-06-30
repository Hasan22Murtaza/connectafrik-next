"use client";

import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import {
  MyOrdersGridShimmer,
  useShimmerCountMd,
} from "@/shared/components/ui/ShimmerLoaders";
import {
  CheckCircle,
  ChevronDown,
  Clock,
  LayoutGrid,
  List,
  Package,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Order {
  id: string;
  order_number: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  delivery_status: string;
  status: string;
  created_at: string;
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

type ViewMode = "grid" | "list";

interface OrderStats {
  purchases: {
    total: number;
    pending: number;
    completed: number;
    totalSpent: number;
  };
  sales: {
    total: number;
    pending: number;
    completed: number;
    totalEarned: number;
  };
}

export function MyOrdersContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"purchases" | "sales">(
    "purchases"
  );
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    purchases: { total: 0, pending: 0, completed: 0, totalSpent: 0 },
    sales: { total: 0, pending: 0, completed: 0, totalEarned: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const shimmerCount = useShimmerCountMd();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "sales") setActiveTab("sales");
    else if (tab === "purchases") setActiveTab("purchases");
  }, [searchParams]);

  useEffect(() => {
    if (user?.id) {
      fetchOrders();
    }
  }, [user?.id]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const [purchasesRes, salesRes, statsRes] = await Promise.all([
        apiClient.get<{ data: Order[]; page: number; pageSize: number; hasMore: boolean }>('/api/orders', { type: 'purchases' }),
        apiClient.get<{ data: Order[]; page: number; pageSize: number; hasMore: boolean }>('/api/orders', { type: 'sales' }),
        apiClient.get<OrderStats>('/api/orders/stats'),
      ]);

      setPurchases(purchasesRes.data || []);
      setSales(salesRes.data || []);
      setStats(statsRes);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
      confirmed: "bg-blue-100 text-blue-700 border-blue-300",
      processing: "bg-purple-100 text-purple-700 border-purple-300",
      shipped: "bg-indigo-100 text-indigo-700 border-indigo-300",
      completed: "bg-green-100 text-green-700 border-green-300",
      cancelled: "bg-red-100 text-red-700 border-red-300",
      refunded: "bg-surface-secondary text-content border-border",
    };
    return colors[status] || "bg-surface-secondary text-content border-border";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
      case "refunded":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

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
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!user) return;

    try {
      setUpdatingOrderId(orderId);

      await apiClient.patch(`/api/orders/${orderId}/status`, { status: newStatus });

      await fetchOrders();
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getNextStatusOptions = (currentStatus: string) => {
    const statusFlow: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
      cancelled: [],
      refunded: []
    };
    return statusFlow[currentStatus] || [];
  };

  const renderOrderCard = (order: Order, isSale: boolean = false) => {
    const otherParty = isSale ? order.buyer : order.seller;
    return (
      <div
        key={order.id}
        className="bg-surface rounded-lg border border-border-subtle shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
      >
        <div className="relative">
          <div className="relative w-full h-36 mb-2 overflow-hidden rounded-t-lg bg-surface-canvas flex items-center justify-center">
            {order.product_image ? (
              <img
                src={order.product_image}
                alt={order.product_title}
                className="w-full h-full object-cover rounded-t-lg transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-surface-secondary rounded-lg flex items-center justify-center border border-border">
                <ShoppingBag className="w-8 h-8 text-content-tertiary" />
              </div>
            )}

            <div
              className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${getStatusColor(
                order.status
              )}`}
            >
              {getStatusIcon(order.status)}
              <span className="capitalize">{order.status}</span>
            </div>
          </div>

          <div className="px-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3
                className="font-semibold text-content sm:text-base text-sm truncate max-w-[300px] hover:text-orange-500 cursor-pointer"
                title={order.product_title}
                onClick={() => router.push(`/my-orders/${order.id}`)}
              >
                {order.product_title}
              </h3>
            </div>
            <p className="text-sm text-content-secondary">
              <span className="font-bold text-black">Order # : </span>
              {order.order_number}
            </p>
          </div>
        </div>

        <div className="flex p-3">
          <div className="flex-1 ">
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2">
              <div>
                <p className="text-xs text-content-secondary">Quantity</p>
                <p className="text-sm font-medium text-content">
                  {order.quantity} item{order.quantity > 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-content-secondary">Total Amount</p>
                <p className="text-sm font-medium text-content">
                  {getCurrencySymbol(order.currency)}
                  {order.total_amount.toLocaleString()}
                </p>
              </div>
              {!isSale && (
                <div>
                  <p className="text-xs text-content-secondary">Payment Status</p>
                  <p
                    className={`text-sm font-medium ${order.payment_status === "completed"
                      ? "text-green-600"
                      : "text-yellow-600"
                      }`}
                  >
                    {order.payment_status === "completed" ? "✓ Paid" : "Pending"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-content-secondary">Order Date</p>
                <p className=" text-[12px] font-medium text-content">
                  {formatDate(order.created_at)}
                </p>
              </div>
              {isSale && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' && (
                <div>
                  <p className="text-xs text-content-secondary mb-1">Order Status</p>
                  <div className="relative group">
                    <select
                      value={order.status}
                      onChange={(e) => {
                        if (e.target.value !== order.status) {
                          updateOrderStatus(order.id, e.target.value);
                        }
                      }}
                      disabled={updatingOrderId === order.id}
                      className="text-xs px-2 py-1 rounded border border-border bg-surface text-content hover:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-6 w-full"
                    >
                      <option value={order.status}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</option>
                      {getNextStatusOptions(order.status).map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-content-secondary pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <div className="flex items-center gap-1.5">
                {otherParty?.avatar_url ? (
                  <img
                    src={otherParty?.avatar_url}
                    alt={otherParty?.full_name}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-600">
                      {otherParty?.full_name?.charAt(0) || "U"}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-content font-medium">
                    {isSale ? "Buyer" : "Seller"}:
                  </span>
                  <span
                    className={`text-xs text-content ${otherParty?.id
                        ? "hover:text-primary-600 hover:underline cursor-pointer"
                        : ""
                      }`}
                    onClick={(e) => {
                      if (!otherParty?.id) return;
                      e.stopPropagation();
                      router.push(`/user/${otherParty.id}`);
                    }}
                  >
                    {otherParty?.full_name || otherParty?.username || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrderRow = (order: Order, isSale: boolean = false) => {
    const otherParty = isSale ? order.buyer : order.seller;
    return (
      <div
        key={order.id}
        className="flex items-stretch gap-3 bg-surface rounded-lg border border-border-subtle shadow-sm hover:shadow-md hover:border-primary-200 transition-all p-2.5"
      >
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-surface-canvas shrink-0 flex items-center justify-center">
          {order.product_image ? (
            <img
              src={order.product_image}
              alt={order.product_title}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-surface-secondary flex items-center justify-center border border-border">
              <ShoppingBag className="w-7 h-7 text-content-tertiary" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="font-semibold text-content sm:text-base text-sm truncate hover:text-orange-500 cursor-pointer"
                title={order.product_title}
                onClick={() => router.push(`/my-orders/${order.id}`)}
              >
                {order.product_title}
              </h3>
              <p className="text-xs text-content-secondary truncate">
                <span className="font-bold text-black">Order # : </span>
                {order.order_number}
              </p>
            </div>
            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 shrink-0 ${getStatusColor(
                order.status
              )}`}
            >
              {getStatusIcon(order.status)}
              <span className="capitalize">{order.status}</span>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
            <div>
              <span className="text-xs text-content-secondary">Qty: </span>
              <span className="text-sm font-medium text-content">
                {order.quantity}
              </span>
            </div>
            <div>
              <span className="text-xs text-content-secondary">Total: </span>
              <span className="text-sm font-medium text-content">
                {getCurrencySymbol(order.currency)}
                {order.total_amount.toLocaleString()}
              </span>
            </div>
            {!isSale && (
              <div>
                <span className="text-xs text-content-secondary">Payment: </span>
                <span
                  className={`text-sm font-medium ${order.payment_status === "completed"
                    ? "text-green-600"
                    : "text-yellow-600"
                    }`}
                >
                  {order.payment_status === "completed" ? "✓ Paid" : "Pending"}
                </span>
              </div>
            )}
            <div className="hidden sm:block">
              <span className="text-xs text-content-secondary">Date: </span>
              <span className="text-[12px] font-medium text-content">
                {formatDate(order.created_at)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {otherParty?.avatar_url ? (
                <img
                  src={otherParty?.avatar_url}
                  alt={otherParty?.full_name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-600">
                    {otherParty?.full_name?.charAt(0) || "U"}
                  </span>
                </div>
              )}
              <span
                className={`text-xs text-content ${otherParty?.id
                    ? "hover:text-primary-600 hover:underline cursor-pointer"
                    : ""
                  }`}
                onClick={(e) => {
                  if (!otherParty?.id) return;
                  e.stopPropagation();
                  router.push(`/user/${otherParty.id}`);
                }}
              >
                {otherParty?.full_name || otherParty?.username || "Unknown"}
              </span>
            </div>

            {isSale &&
              order.status !== "completed" &&
              order.status !== "cancelled" &&
              order.status !== "refunded" && (
                <div className="relative group w-full sm:w-auto">
                  <select
                    value={order.status}
                    onChange={(e) => {
                      if (e.target.value !== order.status) {
                        updateOrderStatus(order.id, e.target.value);
                      }
                    }}
                    disabled={updatingOrderId === order.id}
                    className="text-xs px-2 py-1 rounded border border-border bg-surface text-content hover:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-6 w-full"
                  >
                    <option value={order.status}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </option>
                    {getNextStatusOptions(order.status).map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-content-secondary pointer-events-none" />
                </div>
              )}
          </div>
        </div>
      </div>
    );
  };

  const viewToggle = (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-secondary shrink-0">
      <button
        type="button"
        onClick={() => setViewMode("grid")}
        className={`p-1.5 rounded-md transition-colors ${viewMode === "grid"
          ? "bg-surface text-primary-600 shadow-sm"
          : "text-content-secondary hover:text-content"
          }`}
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode("list")}
        className={`p-1.5 rounded-md transition-colors ${viewMode === "list"
          ? "bg-surface text-primary-600 shadow-sm"
          : "text-content-secondary hover:text-content"
          }`}
        aria-label="List view"
        aria-pressed={viewMode === "list"}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );

  const currentOrders = activeTab === "purchases" ? purchases : sales;
  const activeStats = activeTab === "purchases" ? stats.purchases : stats.sales;
  const primaryLabel = activeTab === "purchases" ? "Total Purchases" : "Total Sales";
  const amountLabel = activeTab === "purchases" ? "Total Spent" : "Earnings";
  const amountValue =
    activeTab === "purchases" ? stats.purchases.totalSpent : stats.sales.totalEarned;

  return (
    <div className="min-h-screen max-w-full bg-surface-canvas px-3 sm:px-4 py-4">
      <div className="">
        <div className="mb-4">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="w-6 h-6 text-primary-600" />
            <h1 className="text-xl font-bold text-content">My Orders</h1>
          </div>
          <p className="text-content-secondary">
            Manage your orders and track their status.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 mb-4">
          <div className="bg-primary-50 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 mb-0.5">
              {activeTab === "purchases" ? (
                <ShoppingCart className="w-4 h-4 text-primary-600" />
              ) : (
                <Package className="w-4 h-4 text-primary-600" />
              )}
              <p className="text-sm text-primary-600 font-medium">
                {primaryLabel}
              </p>
            </div>
            <p className="text-xl font-bold text-primary-700">
              {activeStats.total}
            </p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 mb-0.5">
              <Clock className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-600 font-medium">Pending</p>
            </div>
            <p className="text-xl font-bold text-yellow-700">
              {activeStats.pending}
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 mb-0.5">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-600 font-medium">Completed</p>
            </div>
            <p className="text-xl font-bold text-green-700">
              {activeStats.completed}
            </p>
          </div>

          <div className="bg-primary-200 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-4 h-4 text-primary-700" />
              <p className="text-sm text-primary-700 font-medium">{amountLabel}</p>
            </div>
            <p className="text-xl font-bold text-primary-700">
              ${amountValue.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab("purchases")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'purchases'
                  ? 'bg-primary-600 text-white'
                  : 'text-content-secondary hover:bg-primary-600 hover:text-white bg-surface-tertiary'
                }`}
            >
              My Purchases ({stats.purchases.total})
            </button>
            <button
              onClick={() => setActiveTab("sales")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'sales'
                  ? 'bg-primary-600 text-white'
                  : 'text-content-secondary hover:bg-primary-600 hover:text-white bg-surface-tertiary'
                }`}
            >
              My Sales ({stats.sales.total})
            </button>
          </div>

          {viewToggle}
        </div>
      </div>

      <div className="pt-3">
        {loading ? (
          <MyOrdersGridShimmer count={shimmerCount} />
        ) : currentOrders.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5 sm:gap-2">
              {currentOrders.map((order) =>
                renderOrderCard(order, activeTab === "sales")
              )}
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {currentOrders.map((order) =>
                renderOrderRow(order, activeTab === "sales")
              )}
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-content-tertiary" />
            </div>
            <h3 className="text-lg font-medium text-content mb-2">
              No orders yet
            </h3>
            <p className="text-content-secondary mb-4">
              {activeTab === "purchases"
                ? "Start shopping in the marketplace to see your orders here."
                : "Your sales will appear here once customers purchase your products."}
            </p>
            <button
              onClick={() => router.push("/marketplace")}
              className="btn-primary"
            >
              Browse Marketplace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
