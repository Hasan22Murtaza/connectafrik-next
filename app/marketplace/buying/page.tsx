"use client";

import { useAuth } from "@/contexts/AuthContext";
import ProductBrowseCard from "@/features/marketplace/components/ProductBrowseCard";
import { BUYING_TABS, BuyingTab, CREATE_LISTING_PATH } from "@/features/marketplace/constants/marketplaceConstants";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
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
  LayoutGrid,
  List,
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

type ViewMode = "grid" | "list";

const BuyingPageContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as BuyingTab) || "activity";

  const [savedItems, setSavedItems] = useState<SavedProduct[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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
      className={MP.listRow}
    >
      <div className={MP.listThumb}>
        <img
          src={item.image || FALLBACK_IMAGE}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-content">
          {item.price === 0
            ? "FREE"
            : `${getCurrencySymbol(item.currency)}${item.price.toLocaleString()}`}
        </p>
        <p className="text-sm text-content line-clamp-2 mt-0.5">{item.title}</p>
        <p className="text-xs text-content-secondary mt-1">
          {item.subtitle} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </p>
      </div>
    </button>
  );

  const renderActivityCard = (item: ActivityItem) => (
    <button
      key={item.id}
      type="button"
      onClick={() => router.push(`/marketplace/${item.productId}`)}
      className="group flex flex-col text-left bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-surface-secondary overflow-hidden">
        <img
          src={item.image || FALLBACK_IMAGE}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      </div>
      <div className="p-2 min-w-0">
        <p className="font-bold text-content text-sm">
          {item.price === 0
            ? "FREE"
            : `${getCurrencySymbol(item.currency)}${item.price.toLocaleString()}`}
        </p>
        <p className="text-sm text-content line-clamp-1 mt-0.5">{item.title}</p>
        <p className="text-xs text-content-secondary mt-1 line-clamp-1">
          {item.subtitle} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </p>
      </div>
    </button>
  );

  const renderSavedRow = (product: SavedProduct) => (
    <div key={product.id} className="relative group">
      <button
        type="button"
        onClick={() => router.push(`/marketplace/${product.id}`)}
        className={MP.listRow}
      >
        <div className={MP.listThumb}>
          <img
            src={product.images?.[0] || FALLBACK_IMAGE}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <p className="font-bold text-content">
            {product.price === 0
              ? "FREE"
              : `${getCurrencySymbol(product.currency)}${product.price.toLocaleString()}`}
          </p>
          <p className="text-sm text-content line-clamp-2 mt-0.5">{product.title}</p>
          <p className="text-xs text-content-secondary mt-1">Saved</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleUnsave(product.id);
        }}
        className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-full bg-surface/90 text-primary-600 shadow-sm hover:bg-surface"
        aria-label="Remove from saved"
      >
        <Bookmark className="w-4 h-4 fill-current" />
      </button>
    </div>
  );

  const renderOrderRow = (order: PurchaseOrder) => (
    <button
      key={order.id}
      type="button"
      onClick={() => router.push(`/my-orders/${order.id}`)}
      className={MP.listRow}
    >
      <div className={MP.listThumb}>
        <img
          src={order.product_image || FALLBACK_IMAGE}
          alt={order.product_title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-content">
          {order.currency} {order.total_amount.toLocaleString()}
        </p>
        <p className="text-sm text-content line-clamp-2 mt-0.5">{order.product_title}</p>
        <p className="text-xs text-content-secondary mt-1">
          Order #{order.order_number} · {order.status} ·{" "}
          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );

  const renderOrderCard = (order: PurchaseOrder) => (
    <button
      key={order.id}
      type="button"
      onClick={() => router.push(`/my-orders/${order.id}`)}
      className="group flex flex-col text-left bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-surface-secondary overflow-hidden">
        <img
          src={order.product_image || FALLBACK_IMAGE}
          alt={order.product_title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      </div>
      <div className="p-2 min-w-0">
        <p className="font-bold text-content text-sm">
          {order.currency} {order.total_amount.toLocaleString()}
        </p>
        <p className="text-sm text-content line-clamp-1 mt-0.5">{order.product_title}</p>
        <p className="text-xs text-content-secondary mt-1 line-clamp-1">
          #{order.order_number} · {order.status}
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
          <div className="text-center py-16 bg-surface rounded-xl border border-border-subtle">
            <Clock className="w-12 h-12 text-content-tertiary mx-auto mb-4" />
            <p className="text-content-secondary mb-2">No recent activity yet</p>
            <p className="text-sm text-content-tertiary mb-4">
              Items you save or purchase will appear here
            </p>
            <button onClick={() => router.push("/marketplace")} className="btn-primary">
              Browse Marketplace
            </button>
          </div>
        );
      }
      return viewMode === "grid" ? (
        <div className={MP.productGridCompact}>{activityItems.map(renderActivityCard)}</div>
      ) : (
        <div className={MP.listStack}>{activityItems.map(renderActivityRow)}</div>
      );
    }

    if (activeTab === "saved") {
      if (savedItems.length === 0) {
        return (
          <div className="text-center py-16 bg-surface rounded-xl border border-border-subtle">
            <Bookmark className="w-12 h-12 text-content-tertiary mx-auto mb-4" />
            <p className="text-content-secondary mb-2">No saved items</p>
            <button onClick={() => router.push("/marketplace")} className="btn-primary">
              Browse Marketplace
            </button>
          </div>
        );
      }
      return viewMode === "grid" ? (
        <div className={MP.productGridCompact}>
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
                className="absolute top-2 right-2 p-1.5 rounded-full bg-surface/90 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                aria-label="Remove from saved"
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={MP.listStack}>{savedItems.map(renderSavedRow)}</div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className="text-center py-16 bg-surface rounded-xl border border-border-subtle">
          <ShoppingBag className="w-12 h-12 text-content-tertiary mx-auto mb-4" />
          <p className="text-content-secondary mb-2">No purchases yet</p>
          <button onClick={() => router.push("/marketplace")} className="btn-primary">
            Start shopping
          </button>
        </div>
      );
    }

    return (
      <>
        {viewMode === "grid" ? (
          <div className={MP.productGridCompact}>{orders.map(renderOrderCard)}</div>
        ) : (
          <div className={MP.listStack}>{orders.map(renderOrderRow)}</div>
        )}
        <button
          type="button"
          onClick={() => router.push("/my-orders")}
          className="w-full mt-3 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          View all orders
        </button>
      </>
    );
  };

  const tabTitle =
    BUYING_TABS.find((t) => t.value === activeTab)?.label || "Recent activity";

  const viewToggle = (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-secondary shrink-0">
      <button
        type="button"
        onClick={() => setViewMode("grid")}
        className={`p-1.5 rounded-md transition-colors ${
          viewMode === "grid"
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
        className={`p-1.5 rounded-md transition-colors ${
          viewMode === "list"
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

  if (authLoading) {
    return (
      <div className="min-h-screen px-4 py-6">
        <MarketplaceGridShimmer count={6} />
      </div>
    );
  }

  return (
    <div className={MP.page}>
      <div className={MP.shellFull}>
        <aside className={`hidden lg:block ${MP.sidebarFull}`}>
          <button
            type="button"
            onClick={() => router.push("/marketplace")}
            className={`${MP.backLink} mb-2`}
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </button>

          <div className={MP.sidebarTitleBlock}>
            <h2 className={MP.sidebarTitle}>Buying</h2>
          </div>

          <nav className={MP.sidebarNav}>
            <ul className={MP.navList}>
              {BUYING_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <li key={tab.value}>
                    <button
                      type="button"
                      onClick={() => setTab(tab.value)}
                      className={`${MP.navItem} ${isActive ? MP.navItemActive : MP.navItemInactive
                        }`}
                    >
                      <Icon className={`${MP.navIcon} ${isActive ? MP.navIconActive : ""}`} />
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
            className={MP.createListingBtn}
          >
            <Plus className="w-4 h-4" />
            Create new listing
          </button>
        </aside>

        <main className={MP.main}>
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => router.push("/marketplace")}
              className={`${MP.backLink} mb-2`}
            >
              <ArrowLeft className="w-4 h-4" />
              Marketplace
            </button>
            <h1 className={MP.pageTitle}>Buying</h1>
          </div>

          <div className="lg:hidden flex items-center gap-2 mb-3">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide flex-1">
              {BUYING_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setTab(tab.value)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === tab.value
                      ? "bg-primary-600 text-white"
                      : "bg-surface-secondary text-content-secondary"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {viewToggle}
          </div>

          <div className="hidden lg:flex items-center justify-between mb-4">
            <h1 className={MP.pageTitle}>{tabTitle}</h1>
            {viewToggle}
          </div>

          {renderTabContent()}
        </main>

        <aside className={`hidden xl:block ${MP.sidebarRight}`}>
          <div className={MP.sidebarRightStack}>
            <div className={`${MP.sidebarRightCard} ${MP.sidebarRightPadding}`}>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={
                    buyerAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(buyerName)}&background=random`
                  }
                  alt={buyerName}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-content truncate">{buyerName}</p>
                  <p className="text-sm text-content-secondary">
                    {savedItems.length} saved · {orders.length} purchases
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="w-full py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                See Marketplace profile
              </button>
            </div>

            <div className={`${MP.sidebarRightCard} ${MP.sidebarRightPadding}`}>
              <div className="flex items-start gap-3 text-sm text-content-secondary">
                <HelpCircle className="w-5 h-5 shrink-0 text-content-tertiary" />
                <div>
                  <p className="font-semibold text-content mb-1">Need help?</p>
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
