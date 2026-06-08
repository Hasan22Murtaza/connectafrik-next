"use client";

import { useAuth } from "@/contexts/AuthContext";
import ProductBrowseCard from "@/features/marketplace/components/ProductBrowseCard";
import { BUYING_TABS, BuyingTab, CREATE_LISTING_PATH } from "@/features/marketplace/constants/marketplaceConstants";
import { getCurrencySymbol } from "@/features/marketplace/utils/productFormatting";
import { apiClient } from "@/lib/api-client";
import { MarketplaceGridShimmer } from "@/shared/components/ui/ShimmerLoaders";
import { Product } from "@/shared/types";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  HelpCircle,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface SavedProduct extends Product {
  saved_at?: string;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  product_title: string;
  product_image: string | null;
  product_id?: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: "saved" | "purchased";
  timestamp: string;
  productId: string;
  title: string;
  image: string | null;
  price: number;
  currency: string;
  subtitle?: string;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";

const BuyingPageContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as BuyingTab) || "activity";

  const [savedItems, setSavedItems] = useState<SavedProduct[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const buyerName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Buyer";
  const buyerAvatar = user?.user_metadata?.avatar_url as string | undefined;

  const fetchBuyingData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [savedRes, ordersRes] = await Promise.all([
        apiClient.get<{ data: SavedProduct[] }>("/api/marketplace/saved", {
          limit: 50,
        }),
        apiClient.get<{ data: PurchaseOrder[] }>("/api/orders", {
          type: "purchases",
          limit: 50,
        }),
      ]);

      setSavedItems(savedRes.data || []);
      setOrders(ordersRes.data || []);
    } catch {
      toast.error("Failed to load buying data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin?redirect=/marketplace/buying");
      return;
    }
    fetchBuyingData();
  }, [user, authLoading, router, fetchBuyingData]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const savedActivities: ActivityItem[] = savedItems.map((product) => ({
      id: `saved-${product.id}`,
      type: "saved",
      timestamp: product.saved_at || product.created_at,
      productId: product.id,
      title: product.title,
      image: product.images?.[0] || null,
      price: product.price,
      currency: product.currency,
      subtitle: "Saved",
    }));

    const purchaseActivities: ActivityItem[] = orders.map((order) => ({
      id: `order-${order.id}`,
      type: "purchased",
      timestamp: order.created_at,
      productId: order.product_id || order.id,
      title: order.product_title,
      image: order.product_image,
      price: order.total_amount,
      currency: order.currency,
      subtitle: `Order #${order.order_number}`,
    }));

    return [...savedActivities, ...purchaseActivities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [savedItems, orders]);

  const setTab = (tab: BuyingTab) => {
    router.push(`/marketplace/buying?tab=${tab}`);
  };

  const handleUnsave = async (productId: string) => {
    try {
      await apiClient.post(`/api/marketplace/${productId}/save`);
      setSavedItems((prev) => prev.filter((p) => p.id !== productId));
      toast.success("Removed from saved items");
    } catch {
      toast.error("Failed to update saved item");
    }
  };

  const renderActivityRow = (item: ActivityItem) => (
    <button
      key={item.id}
      type="button"
      onClick={() => router.push(`/marketplace/${item.productId}`)}
      className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left shadow-sm"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
        <img
          src={item.image || FALLBACK_IMAGE}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900">
          {item.price === 0
            ? "FREE"
            : `${getCurrencySymbol(item.currency)}${item.price.toLocaleString()}`}
        </p>
        <p className="text-sm text-gray-800 line-clamp-2 mt-0.5">{item.title}</p>
        <p className="text-xs text-gray-500 mt-1">
          {item.subtitle} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </p>
      </div>
    </button>
  );

  const renderTabContent = () => {
    if (loading) {
      return <MarketplaceGridShimmer count={6} />;
    }

    if (activeTab === "activity") {
      if (activityItems.length === 0) {
        return (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No recent activity yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Items you save or purchase will appear here
            </p>
            <button onClick={() => router.push("/marketplace")} className="btn-primary">
              Browse Marketplace
            </button>
          </div>
        );
      }
      return <div className="space-y-3">{activityItems.map(renderActivityRow)}</div>;
    }

    if (activeTab === "saved") {
      if (savedItems.length === 0) {
        return (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No saved items</p>
            <button onClick={() => router.push("/marketplace")} className="btn-primary">
              Browse Marketplace
            </button>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {savedItems.map((product) => (
            <div key={product.id} className="relative group">
              <ProductBrowseCard
                product={product}
                onView={(id) => router.push(`/marketplace/${id}`)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnsave(product.id);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                aria-label="Remove from saved"
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>
            </div>
          ))}
        </div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No purchases yet</p>
          <button onClick={() => router.push("/marketplace")} className="btn-primary">
            Start shopping
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => router.push(`/my-orders/${order.id}`)}
            className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left shadow-sm"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              <img
                src={order.product_image || FALLBACK_IMAGE}
                alt={order.product_title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">
                {order.currency} {order.total_amount.toLocaleString()}
              </p>
              <p className="text-sm text-gray-800 line-clamp-2 mt-0.5">{order.product_title}</p>
              <p className="text-xs text-gray-500 mt-1">
                Order #{order.order_number} · {order.status} ·{" "}
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </p>
            </div>
          </button>
        ))}
        <button
          type="button"
          onClick={() => router.push("/my-orders")}
          className="w-full py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          View all orders
        </button>
      </div>
    );
  };

  const tabTitle =
    BUYING_TABS.find((t) => t.value === activeTab)?.label || "Recent activity";

  if (authLoading) {
    return (
      <div className="min-h-screen px-4 py-6">
        <MarketplaceGridShimmer count={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4">
      <div className="flex gap-4 min-w-0 w-full max-w-screen-2xl mx-auto">
        <aside className="hidden lg:block w-[260px] shrink-0 py-6">
          <button
            type="button"
            onClick={() => router.push("/marketplace")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 text-sm px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </button>

          <div className="px-2 mb-5">
            <h2 className="text-2xl font-bold text-gray-900">Buying</h2>
          </div>

          <nav className="border-t border-gray-100 pt-4">
            <ul className="space-y-1">
              {BUYING_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <li key={tab.value}>
                    <button
                      type="button"
                      onClick={() => setTab(tab.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-orange-50 text-primary-600"
                          : "text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => router.push(CREATE_LISTING_PATH)}
            className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create new listing
          </button>
        </aside>

        <main className="flex-1 py-6 min-w-0">
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => router.push("/marketplace")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Marketplace
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Buying</h1>
          </div>

          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
            {BUYING_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTab(tab.value)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <h1 className="hidden lg:block text-2xl font-bold text-gray-900 mb-6">{tabTitle}</h1>

          {renderTabContent()}
        </main>

        <aside className="hidden xl:block w-[260px] shrink-0 py-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm sticky top-6">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={
                  buyerAvatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(buyerName)}&background=random`
                }
                alt={buyerName}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{buyerName}</p>
                <p className="text-xs text-gray-500">
                  {savedItems.length} saved · {orders.length} purchases
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="w-full py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors mb-4"
            >
              See Marketplace profile
            </button>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 mb-1">Need help?</p>
                  <button
                    type="button"
                    onClick={() => router.push("/support")}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    See all help topics
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const BuyingPage: React.FC = () => (
  <Suspense
    fallback={
      <div className="min-h-screen px-4 py-6">
        <MarketplaceGridShimmer count={6} />
      </div>
    }
  >
    <BuyingPageContent />
  </Suspense>
);

export default BuyingPage;
