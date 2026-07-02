"use client";

import { useAuth } from "@/contexts/AuthContext";
import SellerListingActions, {
  getListingState,
  getListingTip,
  ListingActionMenuItem,
} from "@/features/marketplace/components/SellerListingActions";
import { CREATE_LISTING_PATH } from "@/features/marketplace/constants/marketplaceConstants";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import { SellerEarnings } from "@/features/marketplace/services/commissionService";
import { formatProductPrice } from "@/features/marketplace/utils/productFormatting";
import { apiClient } from "@/lib/api-client";
import { MarketplaceGridShimmer } from "@/shared/components/ui/ShimmerLoaders";
import { Product } from "@/shared/types";
import { format } from "date-fns";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
  Settings,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type ListingStatus = "all" | "active" | "sold";
type ListingSort = "newest" | "oldest" | "title-asc" | "title-desc";
type ViewMode = "list" | "grid";

const STATUS_FILTERS: { value: ListingStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Available & in stock" },
  { value: "sold", label: "Sold & out of stock" },
];

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "newest", label: "Date listed: newest first" },
  { value: "oldest", label: "Date listed: oldest first" },
  { value: "title-asc", label: "Title (A-Z)" },
  { value: "title-desc", label: "Title (Z-A)" },
];

interface FilterAccordionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterAccordion: React.FC<FilterAccordionProps> = ({
  title,
  expanded,
  onToggle,
  children,
}) => (
  <div>
    <button type="button" onClick={onToggle} className={MP.filterSectionBtn}>
      <span>{title}</span>
      {expanded ? (
        <ChevronUp className="w-4 h-4 text-content-secondary" />
      ) : (
        <ChevronDown className="w-4 h-4 text-content-secondary" />
      )}
    </button>
    {expanded && <div className={MP.filterOptionsList}>{children}</div>}
  </div>
);

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
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [sortExpanded, setSortExpanded] = useState(true);
  const [statusExpanded, setStatusExpanded] = useState(true);

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
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "title-asc":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        result.sort((a, b) => b.title.localeCompare(a.title));
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

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSortBy("newest");
  };

  const hasActiveFilters =
    Boolean(searchTerm) || statusFilter !== "all" || sortBy !== "newest";

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

  const handleRenewListing = async (productId: string) => {
    try {
      await apiClient.patch(`/api/marketplace/${productId}`, {
        is_available: true,
        created_at: new Date().toISOString(),
      });
      toast.success("Listing renewed");
      setListings((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, is_available: true, created_at: new Date().toISOString() }
            : p
        )
      );
    } catch {
      toast.error("Failed to renew listing");
    }
  };

  const handleMarkAsPending = async (productId: string) => {
    try {
      await apiClient.patch(`/api/marketplace/${productId}`, {
        is_available: false,
      });
      toast.success("Listing marked as pending");
      setListings((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_available: false } : p))
      );
    } catch {
      toast.error("Failed to update listing");
    }
  };

  const handleDeleteListing = async (productId: string) => {
    if (!window.confirm("Delete this listing? It will be removed from Marketplace.")) {
      return;
    }

    try {
      await apiClient.delete(`/api/marketplace/${productId}`);
      toast.success("Listing deleted");
      setListings((prev) => prev.filter((p) => p.id !== productId));
    } catch {
      toast.error("Failed to delete listing");
    }
  };

  const handleListingMenuAction = (product: Product, action: ListingActionMenuItem) => {
    switch (action) {
      case "renew":
        handleRenewListing(product.id);
        break;
      case "pending":
        handleMarkAsPending(product.id);
        break;
      case "view":
        router.push(`/marketplace/${product.id}`);
        break;
      case "list-elsewhere":
        toast("Cross-listing to groups and feed is coming soon", { icon: "ℹ️" });
        break;
      case "edit":
        router.push(CREATE_LISTING_PATH);
        break;
      case "delete":
        handleDeleteListing(product.id);
        break;
      case "messages":
        router.push("/chat");
        break;
    }
  };

  const renderListingMeta = (product: Product) => {
    const { statusLabel, statusClassName } = getListingState(product);
    const tip = getListingTip(product.title);

    return (
      <>
        {tip && (
          <p className="flex items-center gap-1 text-xs text-primary-600 mb-0.5">
            <Info className="w-3 h-3 shrink-0" />
            {tip}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-content-secondary">
          <span className={`px-2 py-0.5 rounded-full font-medium ${statusClassName}`}>
            {statusLabel}
          </span>
          <span>Listed {format(new Date(product.created_at), "M/d/yy")}</span>
          <span className="flex items-center gap-0.5">
            <Eye className="w-3 h-3" />
            {product.views_count || 0} clicks on listing
          </span>
        </div>
      </>
    );
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen px-4 py-6">
        <MarketplaceGridShimmer count={6} />
      </div>
    );
  }

  return (
    <div className={MP.page}>
      <div className={MP.shell}>
        <aside className={`hidden lg:block ${MP.sidebar}`}>
          <button
            onClick={() => router.push("/marketplace")}
            className={`${MP.backLink} mb-2`}
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </button>

          <div className={MP.sidebarTitleBlock}>
            <h2 className={MP.sidebarTitle}>Selling</h2>
          </div>

          <button
            onClick={() => router.push(CREATE_LISTING_PATH)}
            className={MP.createListingBtnTop}
          >
            <Plus className="w-3.5 h-3.5" />
            Create new listing
          </button>

          <nav className={`${MP.sidebarNav} ${MP.navList}`}>
            <div className={`${MP.navItem} ${MP.navItemActive}`}>
              <BarChart3 className={`${MP.navIcon} ${MP.navIconActive}`} />
              <span>Your listings</span>
            </div>
            <button
              onClick={() => router.push("/my-orders?tab=sales")}
              className={`${MP.navItem} ${MP.navItemInactive}`}
            >
              <Package className={MP.navIcon} />
              <span>Sales & orders</span>
            </button>
            <button
              onClick={() => router.push("/marketplace/selling/payout-settings")}
              className={`${MP.navItem} ${MP.navItemInactive}`}
            >
              <Settings className={MP.navIcon} />
              <span>Payout settings</span>
            </button>
          </nav>

          <div className={MP.sectionDivider} />

          <div>
            <div className={MP.filterHeader}>
              <h3 className={MP.filterTitle}>Filters</h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={MP.filterClear}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-1">
              <FilterAccordion
                title="Sort by"
                expanded={sortExpanded}
                onToggle={() => setSortExpanded((prev) => !prev)}
              >
                {SORT_OPTIONS.map((option) => (
                  <label key={option.value} className={MP.filterOption}>
                    <input
                      type="radio"
                      name="listing-sort"
                      value={option.value}
                      checked={sortBy === option.value}
                      onChange={() => setSortBy(option.value)}
                      className={MP.filterRadio}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </FilterAccordion>

              <FilterAccordion
                title="Status"
                expanded={statusExpanded}
                onToggle={() => setStatusExpanded((prev) => !prev)}
              >
                {STATUS_FILTERS.map((filter) => (
                  <label key={filter.value} className={MP.filterOption}>
                    <input
                      type="radio"
                      name="listing-status"
                      value={filter.value}
                      checked={statusFilter === filter.value}
                      onChange={() => setStatusFilter(filter.value)}
                      className={MP.filterRadio}
                    />
                    <span>{filter.label}</span>
                  </label>
                ))}
              </FilterAccordion>
            </div>
          </div>
        </aside>

        <main className={MP.main}>
          <div className={`${MP.headerRow} mb-4`}>
            <div>
              <button
                onClick={() => router.push("/marketplace")}
                className={`lg:hidden ${MP.backLink} mb-2`}
              >
                <ArrowLeft className="w-4 h-4" />
                Marketplace
              </button>
              <h1 className={MP.pageTitle}>Your listings</h1>
            </div>
            <button
              onClick={() => router.push(CREATE_LISTING_PATH)}
              className="btn-primary flex items-center gap-1.5 text-sm lg:hidden"
            >
              <Plus className="w-3.5 h-3.5" />
              New listing
            </button>
          </div>

          <div className={`${MP.statsGrid} mb-4`}>
            <div className={`${MP.card} ${MP.cardPadding}`}>
              <div className="flex items-center gap-1.5 text-content-secondary text-xs uppercase tracking-wide mb-0.5">
                <Tag className="w-3 h-3" />
                Active listings
              </div>
              <p className="text-xl font-bold text-content">{stats.active}</p>
            </div>
            <div className={`${MP.card} ${MP.cardPadding}`}>
              <div className="flex items-center gap-1.5 text-content-secondary text-xs uppercase tracking-wide mb-0.5">
                <Eye className="w-3 h-3" />
                Total views
              </div>
              <p className="text-xl font-bold text-content">{stats.totalViews}</p>
            </div>
            <div className={`${MP.card} ${MP.cardPadding}`}>
              <div className="flex items-center gap-1.5 text-content-secondary text-xs uppercase tracking-wide mb-0.5">
                <TrendingUp className="w-3 h-3" />
                Total listings
              </div>
              <p className="text-xl font-bold text-content">{stats.total}</p>
            </div>
            <div className={`${MP.card} ${MP.cardPadding}`}>
              <div className="flex items-center gap-1.5 text-content-secondary text-xs uppercase tracking-wide mb-0.5">
                <Wallet className="w-3 h-3" />
                Pending payout
              </div>
              <p className="text-xl font-bold text-primary-600">
                {earnings?.pending_payout != null
                  ? `$${earnings.pending_payout.toLocaleString()}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className={`${MP.card} ${MP.cardPadding} mb-4`}>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-tertiary" />
                <input
                  type="text"
                  placeholder="Search your listings"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-surface-canvas border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className={`${MP.headerActions} flex-wrap`}>
                <div className="flex lg:hidden gap-1.5 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ListingStatus)}
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
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
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 ${viewMode === "list" ? "bg-primary-50 text-primary-600" : "text-content-secondary"}`}
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 ${viewMode === "grid" ? "bg-primary-50 text-primary-600" : "text-content-secondary"}`}
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
            <div className="text-center py-16 bg-surface rounded-xl border border-border-subtle">
              <Package className="w-12 h-12 text-content-tertiary mx-auto mb-4" />
              <p className="text-content-secondary mb-2">No listings found</p>
              <p className="text-sm text-content-tertiary mb-4">
                {listings.length === 0
                  ? "Create your first listing to start selling"
                  : "Try adjusting your search or filters"}
              </p>
              {listings.length === 0 && (
                <button onClick={() => router.push(CREATE_LISTING_PATH)} className="btn-primary">
                  Create new listing
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className={MP.sellerGrid}>
              {filteredListings.map((product) => {
                const { isActive, isPending } = getListingState(product);
                const image = product.images?.[0];

                return (
                  <div
                    key={product.id}
                    className={`${MP.card}  ${MP.cardPadding}`}
                  >
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/marketplace/${product.id}`)}
                        className="w-16 h-16 rounded-lg overflow-hidden bg-surface-secondary shrink-0"
                      >
                        {image ? (
                          <img src={image} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-content-tertiary">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-content">{formatProductPrice(product)}</p>
                        <h3 className="text-sm font-medium text-content line-clamp-2 mt-0.5">
                          {product.title}
                        </h3>
                        {renderListingMeta(product)}
                      </div>
                    </div>
                    <SellerListingActions
                      isActive={isActive}
                      isPending={isPending}
                      markingSold={markingSoldId === product.id}
                      onMarkAsSold={() => handleMarkAsSold(product.id)}
                      onShare={() => handleShareListing(product)}
                      onMenuAction={(action) => handleListingMenuAction(product, action)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={MP.listStack}>
              {filteredListings.map((product) => {
                const { isActive, isPending } = getListingState(product);
                const image = product.images?.[0];

                return (
                  <div
                    key={product.id}
                    className={`${MP.card} ${MP.cardPadding}`}
                  >
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/marketplace/${product.id}`)}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-surface-secondary shrink-0"
                      >
                        {image ? (
                          <img src={image} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-content-tertiary">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-content">{formatProductPrice(product)}</p>
                        <h3 className="text-sm sm:text-base font-medium text-content line-clamp-2">
                          {product.title}
                        </h3>
                        {renderListingMeta(product)}
                      </div>
                    </div>

                    <SellerListingActions
                      isActive={isActive}
                      isPending={isPending}
                      markingSold={markingSoldId === product.id}
                      onMarkAsSold={() => handleMarkAsSold(product.id)}
                      onShare={() => handleShareListing(product)}
                      onMenuAction={(action) => handleListingMenuAction(product, action)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <aside className={`hidden xl:block ${MP.sidebarRight}`}>
          <div className={MP.sidebarRightStack}>
            <div className={`${MP.sidebarRightCard} ${MP.sidebarRightPadding}`}>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src={
                    sellerAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerName)}&background=random`
                  }
                  alt={sellerName}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content truncate">{sellerName}</p>
                  <p className="text-xs text-content-secondary">
                    {stats.active} active listing{stats.active !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {earnings && (
                <div className="space-y-1.5 text-xs border-t border-border-subtle pt-3 mb-3">
                  <div className="flex justify-between">
                    <span className="text-content-secondary">Total earnings</span>
                    <span className="font-medium">${earnings.total_earnings.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-content-secondary">Paid out</span>
                    <span className="font-medium">${earnings.paid_out.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-content-secondary">Awaiting delivery</span>
                    <span className="font-medium">${earnings.awaiting_delivery.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <button
                  onClick={() => router.push(CREATE_LISTING_PATH)}
                  className={MP.createListingBtnInline}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create new listing
                </button>
                <button
                  onClick={() => router.push("/my-orders?tab=sales")}
                  className="w-full py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  View sales & orders
                </button>
                <button
                  onClick={() => router.push("/marketplace/selling/payout-settings")}
                  className="w-full py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Payout settings
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};

export default SellerDashboardPage;
