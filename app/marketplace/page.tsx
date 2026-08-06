"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  CREATE_LISTING_PATH,
  MarketplaceSort,
} from "@/features/marketplace/constants/marketplaceConstants";
import TradeHubFilterSidebar from "@/features/marketplace/components/TradeHubFilterSidebar";
import MarketplaceHubNav from "@/features/marketplace/components/MarketplaceHubNav";
import ProductBrowseCard from "@/features/marketplace/components/ProductBrowseCard";
import {
  emptyMarketplaceLocationFilter,
  writeStoredMarketplaceFilter,
  type MarketplaceLocationFilter,
} from "@/features/marketplace/utils/marketplaceLocation";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import { apiClient } from "@/lib/api-client";
import {
  MarketplaceGridShimmer,
  MarketplacePageShimmer,
  useShimmerCount,
} from "@/shared/components/ui/ShimmerLoaders";
import { Product } from "@/shared/types";
import {
  Plus,
  Search,
  X,
} from "@/shared/icons";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import ReactPaginate from "react-paginate";
import toast from "react-hot-toast";

const PAGE_SIZE = 12;

const mapSortToApi = (sort: MarketplaceSort): string => {
  const map: Record<MarketplaceSort, string> = {
    newest: "newest",
    oldest: "oldest",
    "price-asc": "price_asc",
    "price-desc": "price_desc",
    featured: "featured",
    nearest: "nearest",
    popular: "popular",
  };
  return map[sort];
};

const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [postedWithinDays, setPostedWithinDays] = useState("");
  const [pickupOnly, setPickupOnly] = useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [urgentSale, setUrgentSale] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState<MarketplaceLocationFilter>(
    emptyMarketplaceLocationFilter
  );
  const [sortBy, setSortBy] = useState<MarketplaceSort>("newest");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const goToCreateListing = () => {
    if (!user) {
      router.push(`/signin?redirect=${CREATE_LISTING_PATH}`);
      return;
    }
    router.push(CREATE_LISTING_PATH);
  };

  const shimmerCount = useShimmerCount();
  const paymentHandledRef = useRef(false);

  const handleLocationFilterChange = useCallback(
    (patch: Partial<MarketplaceLocationFilter>) => {
      setLocationFilter((prev) => {
        const next = { ...prev, ...patch };
        writeStoredMarketplaceFilter(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (paymentHandledRef.current) return;

    const paymentStatus = searchParams.get("payment");
    const message = searchParams.get("message");

    if (paymentStatus === "success") {
      paymentHandledRef.current = true;
      toast.success("Payment successful! Your order has been created.");
      router.replace("/marketplace");
    } else if (paymentStatus === "error") {
      paymentHandledRef.current = true;
      toast.error(
        message ? decodeURIComponent(message) : "Payment failed. Please try again."
      );
      router.replace("/marketplace");
    }
  }, [searchParams, router]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);

      const params: Record<string, string | number | boolean> = {
        page,
        limit: PAGE_SIZE,
        sort: mapSortToApi(sortBy),
      };

      if (selectedCategory) params.category = selectedCategory;
      if (selectedSubcategory) params.subcategory = selectedSubcategory;
      if (selectedCondition) params.condition = selectedCondition;
      if (minPrice.trim()) params.min_price = minPrice.trim();
      if (maxPrice.trim()) params.max_price = maxPrice.trim();
      if (postedWithinDays) params.posted_within_days = postedWithinDays;
      if (pickupOnly) params.pickup_only = true;
      if (deliveryAvailable) params.delivery_available = true;
      if (urgentSale) params.urgent = true;
      if (featuredOnly) params.featured = true;
      if (locationFilter.location.country) {
        params.country = locationFilter.location.country;
      }
      if (
        locationFilter.location.latitude != null &&
        locationFilter.location.longitude != null
      ) {
        params.lat = locationFilter.location.latitude;
        params.lng = locationFilter.location.longitude;
        params.radius_km = locationFilter.radiusKm;
      }
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await apiClient.get<{
        data: Product[];
        hasMore?: boolean;
        pageCount?: number;
        total?: number;
      }>("/api/marketplace", params);

      setProducts(res.data || []);
      const nextPageCount =
        typeof res.pageCount === "number" && res.pageCount > 0
          ? res.pageCount
          : res.hasMore
            ? page + 2
            : Math.max(1, page + 1);
      setPageCount(nextPageCount);
    } catch {
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    selectedCategory,
    selectedSubcategory,
    selectedCondition,
    minPrice,
    maxPrice,
    postedWithinDays,
    pickupOnly,
    deliveryAvailable,
    urgentSale,
    featuredOnly,
    locationFilter,
    debouncedSearch,
    sortBy,
  ]);

  useEffect(() => {
    setPage(0);
  }, [
    selectedCategory,
    selectedSubcategory,
    selectedCondition,
    minPrice,
    maxPrice,
    postedWithinDays,
    pickupOnly,
    deliveryAvailable,
    urgentSale,
    featuredOnly,
    locationFilter,
    debouncedSearch,
    sortBy,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleViewProduct = (productId: string) => {
    router.push(`/marketplace/${productId}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedCondition("");
    setMinPrice("");
    setMaxPrice("");
    setPostedWithinDays("");
    setPickupOnly(false);
    setDeliveryAvailable(false);
    setUrgentSale(false);
    setFeaturedOnly(false);
    const resetLocation = emptyMarketplaceLocationFilter();
    setLocationFilter(resetLocation);
    writeStoredMarketplaceFilter(resetLocation);
    setSortBy("newest");
  };

  const hasActiveFilters =
    searchTerm ||
    selectedCategory ||
    selectedSubcategory ||
    selectedCondition ||
    minPrice ||
    maxPrice ||
    postedWithinDays ||
    pickupOnly ||
    deliveryAvailable ||
    urgentSale ||
    featuredOnly ||
    Boolean(locationFilter.location.country || locationFilter.location.city) ||
    sortBy !== "newest";

  const renderEmptyState = () => (
    <div className="text-center py-16 px-4">
      <p className="text-content-secondary mb-2">No listings found</p>
      <p className="text-sm text-content-tertiary mb-4">
        Try adjusting your filters or create a new listing
      </p>
      {hasActiveFilters && (
        <button onClick={clearFilters} className="text-primary-600 text-sm font-medium">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className={MP.page}>
      <div className={MP.shell}>
        {/* Permanent hub nav (desktop) */}
        <aside className={MP.sidebarBrowse}>
          <MarketplaceHubNav
            activeHub="browse"
            user={user}
            onCreateListing={goToCreateListing}
            onOpenFilters={() => setIsFilterDrawerOpen(true)}
          />
        </aside>

        {/* Amazon-style filter drawer (desktop + mobile) */}
        {isFilterDrawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setIsFilterDrawerOpen(false)}
            aria-hidden
          />
        )}
        <div
          className={`${MP.filterDrawer} ${
            isFilterDrawerOpen ? MP.filterDrawerOpen : MP.filterDrawerClosed
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="TradeHub filters"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white shrink-0">
            <span className="font-bold text-[16px]">Hello, TradeHub</span>
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(false)}
              aria-label="Close filters"
              className="p-1.5 rounded-full hover:bg-primary-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <TradeHubFilterSidebar
            key={isFilterDrawerOpen ? "open" : "closed"}
            filters={{
              category: selectedCategory,
              subcategory: selectedSubcategory,
              condition: selectedCondition,
              minPrice,
              maxPrice,
              postedWithinDays,
              pickupOnly,
              deliveryAvailable,
              urgentSale,
              featuredOnly,
            }}
            onChange={(patch) => {
              if (patch.category !== undefined) setSelectedCategory(patch.category);
              if (patch.subcategory !== undefined) {
                setSelectedSubcategory(patch.subcategory);
              }
              if (patch.condition !== undefined) setSelectedCondition(patch.condition);
              if (patch.minPrice !== undefined) setMinPrice(patch.minPrice);
              if (patch.maxPrice !== undefined) setMaxPrice(patch.maxPrice);
              if (patch.postedWithinDays !== undefined) {
                setPostedWithinDays(patch.postedWithinDays);
              }
              if (patch.pickupOnly !== undefined) setPickupOnly(patch.pickupOnly);
              if (patch.deliveryAvailable !== undefined) {
                setDeliveryAvailable(patch.deliveryAvailable);
              }
              if (patch.urgentSale !== undefined) setUrgentSale(patch.urgentSale);
              if (patch.featuredOnly !== undefined) setFeaturedOnly(patch.featuredOnly);
            }}
            sortBy={sortBy}
            onSortChange={setSortBy}
            location={locationFilter.location}
            radiusKm={locationFilter.radiusKm}
            onLocationChange={(location) =>
              handleLocationFilterChange({ location })
            }
            onLocationFilterApply={(location, radiusKm) =>
              handleLocationFilterChange({ location, radiusKm })
            }
            onClear={clearFilters}
            hasActiveFilters={Boolean(hasActiveFilters)}
            onCloseMobile={() => setIsFilterDrawerOpen(false)}
          />
        </div>

        <main className={MP.mainBrowse}>
          <div className={`${MP.headerRow} mb-3`}>
            <h1 className={`${MP.pageTitleLg} truncate`}>Today&apos;s picks</h1>

            <div className={MP.headerActions}>
              <div className="relative w-full sm:w-56 md:w-64 lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-secondary pointer-events-none" />
                <input
                  className={MP.searchInput}
                  placeholder="Search TradeHub"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search TradeHub"
                />
              </div>

              {user && (
                <button
                  onClick={goToCreateListing}
                  className="btn-primary hidden sm:flex items-center gap-1.5 text-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Listing
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <MarketplaceGridShimmer count={shimmerCount} />
          ) : products.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <div className={MP.productGrid}>
                {products.map((product) => (
                  <ProductBrowseCard
                    key={product.id}
                    product={product}
                    onView={handleViewProduct}
                  />
                ))}
              </div>

              {(pageCount > 1 || page > 0) && (
                <div className="mt-6 mb-2 flex justify-end">
                  <ReactPaginate
                    breakLabel="..."
                    nextLabel="Next"
                    previousLabel="Prev"
                    onPageChange={({ selected }) => {
                      setPage(selected);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    pageRangeDisplayed={3}
                    marginPagesDisplayed={1}
                    pageCount={pageCount}
                    forcePage={page}
                    renderOnZeroPageCount={null}
                    containerClassName="marketplace-paginate"
                    pageClassName="marketplace-paginate__item"
                    pageLinkClassName="marketplace-paginate__link"
                    activeClassName="marketplace-paginate__item--active"
                    previousClassName="marketplace-paginate__item"
                    nextClassName="marketplace-paginate__item"
                    previousLinkClassName="marketplace-paginate__link marketplace-paginate__link--nav"
                    nextLinkClassName="marketplace-paginate__link marketplace-paginate__link--nav"
                    disabledClassName="marketplace-paginate__item--disabled"
                    breakClassName="marketplace-paginate__item"
                    breakLinkClassName="marketplace-paginate__link marketplace-paginate__link--break"
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {user && (
        <button
          onClick={goToCreateListing}
          className="sm:hidden fixed bottom-5 right-5 z-20 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 transition-colors"
          aria-label="Create Listing"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

const MarketplacePageWrapper: React.FC = () => {
  return (
    <Suspense fallback={<MarketplacePageShimmer />}>
      <MarketplacePage />
    </Suspense>
  );
};

export default MarketplacePageWrapper;
