"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
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
    full_name: string;
    username: string;
    avatar_url: string | null;
  };
  buyer?: {
    full_name: string;
    username: string;
    avatar_url: string | null;
  };
}

const MyOrders: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"purchases" | "sales">(
    "purchases"
  );
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch purchases (orders where user is buyer)
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("order_with_parties")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (purchasesError) throw purchasesError;

      // Fetch sales (orders where user is seller)
      const { data: salesData, error: salesError } = await supabase
        .from("order_with_parties")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (salesError) throw salesError;

      // Transform the flat view data to match the Order interface structure
      const transformOrder = (order: any): Order => ({
        ...order,
        seller: order.seller_id_profile
          ? {
              username: order.seller_username,
              full_name: order.seller_full_name,
              avatar_url: order.seller_avatar_url,
            }
          : undefined,
        buyer: order.buyer_id_profile
          ? {
              username: order.buyer_username,
              full_name: order.buyer_full_name,
              avatar_url: order.buyer_avatar_url,
            }
          : undefined,
      });

      setPurchases((purchasesData || []).map(transformOrder));
      setSales((salesData || []).map(transformOrder));
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
      refunded: "bg-gray-100 text-gray-700 border-gray-300",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-300";
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

  const renderOrderCard = (order: Order, isSale: boolean = false) => {
    const otherParty = isSale ? order.buyer : order.seller;
    return (
      <div
        key={order.id}
        className="bg-white rounded-lg border border-gray-200  hover:shadow-md hover:border-primary-200 transition-all"
      >
        <div className="relative">
  {/* Image + Status */}
  <div className="relative w-full h-48 mb-3 overflow-hidden rounded-t-lg bg-gray-50 flex items-center justify-center">
    {order.product_image ? (
      <img
        src={order.product_image}
        alt={order.product_title}
        className="w-full h-full object-cover rounded-t-lg transition-transform duration-300 hover:scale-105"
      />
    ) : (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
        <ShoppingBag className="w-8 h-8 text-gray-400" />
      </div>
    )}

    {/* Status badge on image top-right */}
    <div
      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${getStatusColor(
        order.status
      )}`}
    >
      {getStatusIcon(order.status)}
      <span className="capitalize">{order.status}</span>
    </div>
  </div>

  {/* Title + Order Number */}
  <div className="px-4">
    <h3 className="font-semibold text-gray-900 mb-1 sm:text-lg text-sm truncate max-w-[300px] hover:text-orange-500 cursor-pointer" title={order.product_title}>
      {order.product_title}
    </h3>
    <p className="text-sm text-gray-500">
      <span className="font-bold text-black">Order # : </span>
      {order.order_number}
    </p>
  </div>
</div>


        <div className="flex p-4">
          {/* Order Details */}
          <div className="flex-1 ">
            {/* Order Info */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-500">Quantity</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.quantity} item{order.quantity > 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-sm font-medium text-gray-900">
                  {getCurrencySymbol(order.currency)}
                  {order.total_amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Status</p>
                <p
                  className={`text-sm font-medium ${
                    order.payment_status === "completed"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }`}
                >
                  {order.payment_status === "completed" ? "✓ Paid" : "Pending"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Order Date</p>
                <p className=" text-[12px] font-medium text-gray-900">
                  {formatDate(order.created_at)}
                </p>
              </div>
            </div>

            {/* Other Party Info */}
            
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-2">
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
                    <span className="text-xs text-gray-800 font-medium">
                      {isSale ? "Buyer" : "Seller"}:
                    </span>
                    <span className="text-xs text-gray-800 ">
                      {otherParty?.full_name || otherParty?.username || "Unknown"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/my-orders/${order.id}`)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  View Details
                </button>
              </div>
            
          </div>
        </div>
      </div>
    );
  };

  const currentOrders = activeTab === "purchases" ? purchases : sales;

  const stats = {
    purchases: {
      total: purchases.length,
      pending: purchases.filter((o) => o.status === "pending").length,
      completed: purchases.filter((o) => o.status === "completed").length,
      totalSpent: purchases
        .filter((o) => o.payment_status === "completed")
        .reduce((sum, o) => sum + o.total_amount, 0),
    },
    sales: {
      total: sales.length,
      pending: sales.filter((o) => o.status === "pending").length,
      completed: sales.filter((o) => o.status === "completed").length,
      totalEarned: sales
        .filter((o) => o.payment_status === "completed")
        .reduce((sum, o) => sum + o.total_amount, 0),
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-2 mb-6">
            <ShoppingBag className="w-7 h-7 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          </div>

          {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6">
  {/* Total Purchases */}
  <div className="bg-primary-50 rounded-lg p-2 sm:p-4">
    <div className="flex items-center space-x-1 mb-1">
      <ShoppingCart className="w-6 h-6 text-primary-600" />
      <p className="text-sm text-primary-600 font-medium">
        Total Purchases
      </p>
    </div>
    <p className="text-2xl font-bold text-primary-700">
      {stats.purchases.total}
    </p>
  </div>

  {/* Completed */}
  <div className="bg-green-50 rounded-lg p-2 sm:p-4">
    <div className="flex items-center space-x-1 mb-1">
      <CheckCircle className="w-6 h-6 text-green-600" />
      <p className="text-sm text-green-600 font-medium">Completed</p>
    </div>
    <p className="text-2xl font-bold text-green-700">
      {stats.purchases.completed}
    </p>
  </div>

  {/* Total Sales */}
  <div className="bg-primary-100 rounded-lg p-2 sm:p-4">
    <div className="flex items-center space-x-1 mb-1">
      <Package className="w-6 h-6 text-primary-600" />
      <p className="text-sm text-primary-600 font-medium">
        Total Sales
      </p>
    </div>
    <p className="text-2xl font-bold text-primary-700">
      {stats.sales.total}
    </p>
  </div>

  {/* Earnings */}
  <div className="bg-primary-200 rounded-lg p-2 sm:p-4">
    <div className="flex items-center space-x-1 mb-1">
      <TrendingUp className="w-6 h-6 text-primary-700" />
      <p className="text-sm text-primary-700 font-medium">Earnings</p>
    </div>
    <p className="text-2xl font-bold text-primary-700">
      ${stats.sales.totalEarned.toLocaleString()}
    </p>
  </div>
</div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("purchases")}
              className={`flex-1 py-2 sm:px-4 px-2 rounded-md font-medium transition-colors ${
                activeTab === "purchases"
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Purchases ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab("sales")}
              className={`flex-1 py-2 sm:px-4 px-2 rounded-md font-medium transition-colors ${
                activeTab === "sales"
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Sales ({sales.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : currentOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentOrders.map((order) =>
              renderOrderCard(order, activeTab === "sales")
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No orders yet
            </h3>
            <p className="text-gray-500 mb-4">
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
};

export default MyOrders;
