"use client";

import { useAuth } from "@/contexts/AuthContext";
import CreateProductModal from "@/features/marketplace/components/CreateProductModal-v2";
import { SellerEarnings } from "@/features/marketplace/services/commissionService";
import { formatProductPrice } from "@/features/marketplace/utils/productFormatting";
import { apiClient } from "@/lib/api-client";
import { MarketplaceGridShimmer } from "@/shared/components/ui/ShimmerLoaders";
import { Product } from "@/shared/types";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
  Share2,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type ListingStatus = "all" | "active" | "sold";
type ListingSort = "newest" | "views" | "price-asc" | "price-desc";
type ViewMode = "list" | "grid";

const STATUS_FILTERS: { value: ListingStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold / Unavailable" },
];

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "views", label: "Most views" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const SellerDashboardPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<Product[]>([]);
  const [earnings, setEarnings] = useState<SellerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingStatus>("all");
  const [sortBy, setSortBy] = useState<ListingSort>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);

  const sellerName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Seller";
  const sellerAvatar = user?.user_metadata?.avatar_url as string | undefined;

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const allListings: Product[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await apiClient.get<{ data: Product[]; hasMore?: boolean }>(
          "/api/marketplace",
          {
            seller_id: user.id,
            include_unavailable: "true",
            page,
            limit: 50,
          }
        );
        const pageListings = res.data || [];
        allListings.push(...pageListings);
        hasMore = Boolean(res.hasMore);
        page += 1;
        if (pageListings.length === 0) break;
      }

      setListings(allListings);

      try {
        const earningsRes = await apiClient.get<{ data: SellerEarnings }>(
          "/api/marketplace/earnings"
        );
        setEarnings(earningsRes.data);
      } catch {
        setEarnings(null);
      }
    } catch {
      toast.error("Failed to load seller dashboard");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin?redirect=/marketplace/selling");
      return;
    }
    fetchDashboardData();
  }, [user, authLoading, router, fetchDashboardData]);

  const filteredListings = useMemo(() => {
    let result = [...listings];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    if (statusFilter === "active") {
      result = result.filter((p) => p.is_available && p.stock_quantity > 0);
    } else if (statusFilter === "sold") {
      result = result.filter((p) => !p.is_available || p.stock_quantity === 0);
    }

    switch (sortBy) {
      case "views":
        result.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        break;
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [listings, searchTerm, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const active = listings.filter((p) => p.is_available && p.stock_quantity > 0);
    const totalViews = listings.reduce((sum, p) => sum + (p.views_count || 0), 0);
    return {
      total: listings.length,
      active: active.length,
      totalViews,
    };
  }, [listings]);

  const handleMarkAsSold = async (productId: string) => {
    try {
      setMarkingSoldId(productId);
      await apiClient.patch(`/api/marketplace/${productId}`, {
        is_available: false,
        stock_quantity: 0,
      });
      toast.success("Listing marked as sold");
      setListings((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, is_available: false, stock_quantity: 0 }
            : p
        )
      );
    } catch {
      toast.error("Failed to update listing");
    } finally {
      setMarkingSoldId(null);
    }
  };

  const handleShareListing = async (product: Product) => {
    const shareUrl = `${window.location.origin}/marketplace/${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `${product.title} - ${formatProductPrice(product)}`,
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Failed to share listing");
        }
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Listing link copied!");
    }
  };

  const getListingStatus = (product: Product) => {
    if (!product.is_available || product.stock_quantity === 0) {
      return { label: "Sold", className: "bg-gray-100 text-gray-700" };
    }
    return { label: "Active", className: "bg-green-100 text-green-700" };
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen px-4 py-6">
        <MarketplaceGridShimmer count={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4">
      <div className="flex gap-4 min-w-0 w-full max-w-screen-2xl mx-auto">
        <aside className="hidden lg:block w-[240px] shrink-0 py-6">
          <button
            onClick={() => router.push("/marketplace")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 text-sm px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </button>

          <div className="px-2 mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Selling</h2>
          </div>


          <nav className="border-t border-gray-100 pt-4 space-y-1">
            <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-orange-50 text-primary-600">
              <BarChart3 className="w-[18px] h-[18px]" />
              <span className="text-sm font-medium">Your listings</span>
            </div>
            <button
              onClick={() => router.push("/my-orders?tab=sales")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-primary-600 transition-colors"
            >
              <Package className="w-[18px] h-[18px]" />
              <span className="text-sm font-medium">Sales & orders</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 py-6 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div>
              <button
                onClick={() => router.push("/marketplace")}
                className="lg:hidden flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Marketplace
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Your listings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage inventory, track views, and mark items as sold
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2 text-sm lg:hidden"
            >
              <Plus className="w-4 h-4" />
              New listing
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide mb-1">
                <Tag className="w-3.5 h-3.5" />
                Active listings
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide mb-1">
                <Eye className="w-3.5 h-3.5" />
                Total views
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalViews}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Total listings
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide mb-1">
                <Wallet className="w-3.5 h-3.5" />
                Pending payout
              </div>
              <p className="text-2xl font-bold text-primary-600">
                {earnings?.pending_payout != null
                  ? `$${earnings.pending_payout.toLocaleString()}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search your listings"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ListingStatus)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  {STATUS_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ListingSort)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 ${viewMode === "list" ? "bg-primary-50 text-primary-600" : "text-gray-500"}`}
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 ${viewMode === "grid" ? "bg-primary-50 text-primary-600" : "text-gray-500"}`}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <MarketplaceGridShimmer count={6} />
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No listings found</p>
              <p className="text-sm text-gray-400 mb-4">
                {listings.length === 0
                  ? "Create your first listing to start selling"
                  : "Try adjusting your search or filters"}
              </p>
              {listings.length === 0 && (
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                  Create new listing
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredListings.map((product) => {
                const status = getListingStatus(product);
                const image = product.images?.[0];
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm"
                  >
                    <button
                      onClick={() => router.push(`/marketplace/${product.id}`)}
                      className="block w-full aspect-square bg-gray-100"
                    >
                      {image ? (
                        <img src={image} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </button>
                    <div className="p-3">
                      <p className="font-bold text-gray-900 truncate">
                        {formatProductPrice(product)}
                      </p>
                      <p className="text-sm text-gray-700 line-clamp-2 mt-0.5">{product.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {product.views_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map((product) => {
                const status = getListingStatus(product);
                const image = product.images?.[0];
                const isActive = product.is_available && product.stock_quantity > 0;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 shadow-sm flex gap-3 sm:gap-4"
                  >
                    <button
                      onClick={() => router.push(`/marketplace/${product.id}`)}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0"
                    >
                      {image ? (
                        <img src={image} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900">
                            {formatProductPrice(product)}
                          </p>
                          <h3 className="text-sm sm:text-base font-medium text-gray-800 truncate">
                            {product.title}
                          </h3>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${status.className}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {product.views_count || 0} views
                        </span>
                        <span>
                          Listed {format(new Date(product.created_at), "M/d/yy")}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(product.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {isActive && (
                          <button
                            onClick={() => handleMarkAsSold(product.id)}
                            disabled={markingSoldId === product.id}
                            className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {markingSoldId === product.id ? "Updating..." : "Mark as sold"}
                          </button>
                        )}
                        <button
                          onClick={() => handleShareListing(product)}
                          className="px-3 py-1.5 text-xs sm:text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share
                        </button>
                        <button
                          onClick={() => router.push(`/marketplace/${product.id}`)}
                          className="px-3 py-1.5 text-xs sm:text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          View listing
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <aside className="hidden xl:block w-[260px] shrink-0 py-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm sticky top-6">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={
                  sellerAvatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerName)}&background=random`
                }
                alt={sellerName}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{sellerName}</p>
                <p className="text-xs text-gray-500">{stats.active} active listing{stats.active !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {earnings && (
              <div className="space-y-2 text-sm border-t border-gray-100 pt-4 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total earnings</span>
                  <span className="font-medium">${earnings.total_earnings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid out</span>
                  <span className="font-medium">${earnings.paid_out.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Awaiting delivery</span>
                  <span className="font-medium">${earnings.awaiting_delivery.toLocaleString()}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full btn-primary text-sm mb-2"
            >
              Create new listing
            </button>
            <button
              onClick={() => router.push("/my-orders?tab=sales")}
              className="w-full py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              View sales & orders
            </button>
          </div>
        </aside>
      </div>

      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
};

export default SellerDashboardPage;
