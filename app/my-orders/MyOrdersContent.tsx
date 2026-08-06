"use client";

import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import {
  getNextOrderStatuses,
  getOrderDisplayLabelText,
  getSellerTransitionLabel,
} from "@/lib/marketplace/orderStatus";
import {
  MyOrdersListShimmer,
  useShimmerCountMd,
} from "@/shared/components/ui/ShimmerLoaders";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  X,
  XCircle,
} from "@/shared/icons";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
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
  payment_method?: string | null;
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

type StatusFilter =
  | "all"
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

type SortOption = "newest" | "oldest" | "amount-high" | "amount-low";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-high", label: "Amount: high to low" },
  { value: "amount-low", label: "Amount: low to high" },
];

const PROGRESS_STEPS = [
  { key: "placed", label: "Placed", shortLabel: "Placed", Icon: ShoppingBag },
  { key: "paid", label: "Paid", shortLabel: "Paid", Icon: CreditCard },
  {
    key: "processing",
    label: "Processing",
    shortLabel: "Process",
    Icon: Package,
  },
  { key: "shipped", label: "Shipped", shortLabel: "Ship", Icon: Truck },
  {
    key: "delivered",
    label: "Delivered",
    shortLabel: "Done",
    Icon: CheckCircle,
  },
] as const;

function getProgressIndex(order: Order): number {
  const status = (order.status || "").toLowerCase();
  if (status === "cancelled" || status === "refunded") return -1;
  if (status === "completed" || status === "delivered") return 4;
  if (status === "shipped") return 3;
  if (status === "processing" || status === "confirmed") return 2;
  if (order.payment_status === "completed") return 1;
  return 0;
}

function matchesStatusFilter(order: Order, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  const status = (order.status || "").toLowerCase();
  switch (filter) {
    case "pending":
      return (
        status === "pending" ||
        (order.payment_status !== "completed" &&
          status !== "cancelled" &&
          status !== "refunded")
      );
    case "processing":
      return status === "confirmed" || status === "processing";
    case "shipped":
      return status === "shipped";
    case "delivered":
      return status === "delivered" || status === "completed";
    case "cancelled":
      return status === "cancelled";
    case "refunded":
      return status === "refunded";
    default:
      return true;
  }
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
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
        apiClient.get<{
          data: Order[];
          page: number;
          pageSize: number;
          hasMore: boolean;
        }>("/api/orders", { type: "purchases" }),
        apiClient.get<{
          data: Order[];
          page: number;
          pageSize: number;
          hasMore: boolean;
        }>("/api/orders", { type: "sales" }),
        apiClient.get<OrderStats>("/api/orders/stats"),
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

  const getOrderStatusContext = (order: Order) => ({
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
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

  const formatDate = (dateString: string, compact = false) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: compact ? "short" : "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!user) return;

    try {
      setUpdatingOrderId(orderId);

      await apiClient.patch(`/api/orders/${orderId}/status`, {
        status: newStatus,
      });

      await fetchOrders();
      toast.success(
        `Order updated to ${getOrderDisplayLabelText({
          status: newStatus,
          payment_status: "completed",
        })}`
      );
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const switchTab = (tab: "purchases" | "sales") => {
    setActiveTab(tab);
    setStatusFilter("all");
    setSearchQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/my-orders?${params.toString()}`, { scroll: false });
  };

  const currentOrders = activeTab === "purchases" ? purchases : sales;
  const activeStats = activeTab === "purchases" ? stats.purchases : stats.sales;
  const amountLabel = activeTab === "purchases" ? "Total Spent" : "Earnings";
  const amountValue =
    activeTab === "purchases"
      ? stats.purchases.totalSpent
      : stats.sales.totalEarned;
  const countLabel = activeTab === "purchases" ? "Purchases" : "Sales";

  const filteredOrders = useMemo(() => {
    let list = currentOrders.filter((order) =>
      matchesStatusFilter(order, statusFilter)
    );

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (order) =>
          order.product_title.toLowerCase().includes(q) ||
          order.order_number.toLowerCase().includes(q) ||
          order.seller?.full_name?.toLowerCase().includes(q) ||
          order.seller?.username?.toLowerCase().includes(q) ||
          order.buyer?.full_name?.toLowerCase().includes(q) ||
          order.buyer?.username?.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "amount-high":
          return b.total_amount - a.total_amount;
        case "amount-low":
          return a.total_amount - b.total_amount;
        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return list;
  }, [currentOrders, statusFilter, searchQuery, sortBy]);

  const renderProgressTracker = (order: Order) => {
    const current = getProgressIndex(order);
    if (current < 0) {
      const isCancelled = (order.status || "").toLowerCase() === "cancelled";
      return (
        <div
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
            isCancelled
              ? "bg-red-50 text-red-600"
              : "bg-surface-secondary text-content-secondary"
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          {isCancelled ? "Cancelled" : "Refunded"}
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="flex items-start">
          {PROGRESS_STEPS.map((step, index) => {
            const done = index <= current;
            const isCurrent = index === current;
            const StepIcon = step.Icon;
            return (
              <div key={step.key} className="flex-1 flex items-start min-w-0">
                <div className="flex flex-col items-center gap-0.5 w-full min-w-0">
                  <div className="flex items-center w-full">
                    <div
                      className={`h-0.5 flex-1 rounded-full transition-colors ${
                        index === 0
                          ? "bg-transparent"
                          : index <= current
                            ? "bg-primary-500"
                            : "bg-border"
                      }`}
                    />
                    <div
                      className={`relative z-[1] w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isCurrent
                          ? "bg-primary-600 text-white shadow-sm ring-2 ring-primary-200"
                          : done
                            ? "bg-primary-100 text-primary-700"
                            : "bg-surface-secondary text-content-tertiary"
                      }`}
                      title={step.label}
                    >
                      <StepIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </div>
                    <div
                      className={`h-0.5 flex-1 rounded-full transition-colors ${
                        index === PROGRESS_STEPS.length - 1
                          ? "bg-transparent"
                          : index < current
                            ? "bg-primary-500"
                            : "bg-border"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[9px] sm:text-[10px] leading-tight text-center px-0.5 truncate w-full ${
                      isCurrent
                        ? "text-primary-700 font-semibold"
                        : done
                          ? "text-content font-medium"
                          : "text-content-tertiary"
                    }`}
                  >
                    <span className="sm:hidden">{step.shortLabel}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOrderItem = (order: Order, isSale: boolean) => {
    const otherParty = isSale ? order.buyer : order.seller;
    const statusContext = getOrderStatusContext(order);
    const displayStatus = getOrderDisplayLabelText(statusContext);
    const canUpdateStatus =
      isSale &&
      order.status !== "completed" &&
      order.status !== "cancelled" &&
      order.status !== "refunded";

    return (
      <article
        key={order.id}
        className="group bg-surface rounded-xl shadow-sm ring-1 ring-border-subtle hover:ring-primary-200 hover:shadow-md transition-all overflow-hidden"
      >
        <div className="p-3 sm:p-3.5">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push(`/my-orders/${order.id}`)}
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-surface-secondary shrink-0 ring-1 ring-black/5"
              aria-label={`View order for ${order.product_title}`}
            >
              {order.product_image ? (
                <img
                  src={order.product_image}
                  alt={order.product_title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-content-tertiary" />
                </div>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/my-orders/${order.id}`)}
                  className="min-w-0 text-left flex-1"
                >
                  <h3 className="font-semibold text-content text-sm leading-snug line-clamp-1 group-hover:text-primary-600 transition-colors">
                    {order.product_title}
                  </h3>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/my-orders/${order.id}`)}
                  className="hidden sm:inline-flex items-center gap-0.5 shrink-0 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-none">
                <span className="font-semibold text-content">
                  {getCurrencySymbol(order.currency)}
                  {order.total_amount.toLocaleString()}
                </span>
                <span className="text-content-tertiary">·</span>
                <span className="text-content-secondary text-xs">
                  Qty {order.quantity}
                </span>
                <span className="text-content-tertiary">·</span>
                <span className="text-xs text-content-tertiary">
                  {formatDate(order.created_at, true)}
                </span>
              </div>

              {otherParty && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (otherParty.id) router.push(`/user/${otherParty.id}`);
                  }}
                  className="mt-1.5 flex items-center gap-1.5 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  {otherParty.avatar_url ? (
                    <img
                      src={otherParty.avatar_url}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-primary-600">
                        {otherParty.full_name?.charAt(0) || "U"}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-content-secondary truncate">
                    {isSale ? "Buyer" : "Seller"}:{" "}
                    <span className="text-content font-medium">
                      {otherParty.full_name ||
                        otherParty.username ||
                        "Unknown"}
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-border-subtle flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex-1 min-w-0">{renderProgressTracker(order)}</div>

            <div className="flex items-center gap-2 sm:shrink-0">
              {canUpdateStatus && (
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={order.status}
                    onChange={(e) => {
                      if (e.target.value !== order.status) {
                        updateOrderStatus(order.id, e.target.value);
                      }
                    }}
                    disabled={updatingOrderId === order.id}
                    className="w-full sm:w-auto text-xs pl-2.5 pr-7 py-1.5 rounded-lg bg-surface-secondary text-content hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50 appearance-none cursor-pointer"
                    aria-label="Update order status"
                  >
                    <option value={order.status}>{displayStatus}</option>
                    {getNextOrderStatuses(order.status).map((status) => (
                      <option key={status} value={status}>
                        {getSellerTransitionLabel(status)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-content-secondary pointer-events-none" />
                </div>
              )}

              <button
                type="button"
                onClick={() => router.push(`/my-orders/${order.id}`)}
                className="sm:hidden flex-1 inline-flex items-center justify-center gap-0.5 min-h-[40px] px-3 py-2 rounded-lg bg-primary-50 text-sm font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
              >
                View Order
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      <div className="w-full max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <header className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-content tracking-tight">
            My Orders
          </h1>
          <p className="mt-1 text-sm text-content-secondary max-w-2xl leading-relaxed">
            Track your purchases, manage your sales, and stay updated with your
            marketplace activity.
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, products, or people…"
                className="w-full pl-10 pr-10 py-3 sm:py-2.5 bg-surface border border-border-subtle rounded-2xl sm:rounded-xl text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-shadow"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-content-tertiary hover:text-content rounded-full"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  showFilters || statusFilter !== "all"
                    ? "bg-primary-50 border-primary-200 text-primary-700"
                    : "bg-surface border-border-subtle text-content hover:bg-surface-hover"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
                {statusFilter !== "all" && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-primary-600" />
                )}
              </button>

              <div className="relative flex-1 sm:flex-none">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full appearance-none pl-3.5 pr-9 py-2.5 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-medium bg-surface border border-border-subtle text-content hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary-200 cursor-pointer"
                  aria-label="Sort orders"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-secondary pointer-events-none" />
              </div>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              showFilters ? "max-h-32 opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    statusFilter === f.value
                      ? "bg-content text-surface shadow-sm"
                      : "bg-surface-secondary text-content-secondary hover:bg-surface-hover hover:text-content"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            {
              icon: activeTab === "purchases" ? ShoppingCart : Package,
              label: countLabel,
              value: String(activeStats.total),
            },
            {
              icon: Clock,
              label: "Pending",
              value: String(activeStats.pending),
            },
            {
              icon: CheckCircle,
              label: "Completed",
              value: String(activeStats.completed),
            },
            {
              icon: TrendingUp,
              label: amountLabel,
              value: `$${amountValue.toLocaleString()}`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-surface rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 ring-1 ring-border-subtle shadow-sm hover:ring-primary-200 transition-all group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="w-3.5 h-3.5 text-content-tertiary group-hover:text-primary-600 transition-colors" />
                <span className="text-[11px] sm:text-xs text-content-secondary font-medium truncate">
                  {stat.label}
                </span>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-content tracking-tight tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Underline tabs — no empty filler */}
        <div className="mb-4 sm:mb-5 border-b border-border-subtle">
          <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-none">
            {(["purchases", "sales"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === "purchases" ? stats.purchases.total : stats.sales.total;
              const label = tab === "purchases" ? "Purchases" : "Sales";
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => switchTab(tab)}
                  className={`relative shrink-0 px-4 sm:px-5 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-primary-600"
                      : "text-content-secondary hover:text-content"
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1.5 tabular-nums ${
                      isActive ? "text-primary-600" : "text-content-tertiary"
                    }`}
                  >
                    ({count})
                  </span>
                  {isActive && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Order list */}
        {loading ? (
          <MyOrdersListShimmer count={shimmerCount} />
        ) : filteredOrders.length > 0 ? (
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {filteredOrders.map((order) =>
              renderOrderItem(order, activeTab === "sales")
            )}
          </div>
        ) : (
          <div className="text-center py-14 sm:py-16 px-4 bg-surface rounded-2xl shadow-sm ring-1 ring-border-subtle">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-5">
              <div className="absolute inset-0 rounded-full bg-primary-50 animate-pulse" />
              <div className="relative w-full h-full rounded-full bg-surface-secondary flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 sm:w-9 sm:h-9 text-content-tertiary" />
              </div>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-content mb-1.5">
              {searchQuery || statusFilter !== "all"
                ? "No matching orders"
                : "No orders yet"}
            </h3>
            <p className="text-sm text-content-secondary mb-5 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : activeTab === "purchases"
                  ? "Start shopping in the marketplace to see your orders here."
                  : "Your sales will appear here once customers purchase your products."}
            </p>
            {searchQuery || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 min-h-[44px] px-4"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="btn-primary min-h-[44px]"
              >
                Browse TradeHub
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
