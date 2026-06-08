"use client";

import { useAuth } from "@/contexts/AuthContext";
import MarketplaceHubNav from "@/features/marketplace/components/MarketplaceHubNav";
import ProductBrowseCard from "@/features/marketplace/components/ProductBrowseCard";
import {
  CREATE_LISTING_PATH,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_COUNTRIES,
  MARKETPLACE_CURRENCIES,
  MARKETPLACE_SORT_OPTIONS,
  MarketplaceSort,
} from "@/features/marketplace/constants/marketplaceConstants";
import { MP } from "@/features/marketplace/constants/marketplaceLayout";
import {
  formatCurrencyDisplay,
  getCurrencyForCountry,
} from "@/features/marketplace/utils/countryCurrency";
import { apiClient } from "@/lib/api-client";
import {
  MarketplaceGridShimmer,
  MarketplacePageShimmer,
  useShimmerCount,
} from "@/shared/components/ui/ShimmerLoaders";
import { useProfile } from "@/shared/hooks/useProfile";
import { Product } from "@/shared/types";
import {
  ArrowLeft,
  ChevronDown,
  Filter,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

const PAGE_SIZE = 24;

const mapSortToApi = (sort: MarketplaceSort): string => {
  const map: Record<MarketplaceSort, string> = {
    newest: "newest",
    "price-asc": "price_asc",
    "price-desc": "price_desc",
    featured: "featured",
  };
  return map[sort];
};

const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [sortBy, setSortBy] = useState<MarketplaceSort>("newest");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const goToCreateListing = () => {
    if (!user) {
      router.push(`/signin?redirect=${CREATE_LISTING_PATH}`);
      return;
    }
    router.push(CREATE_LISTING_PATH);
  };

  const shimmerCount = useShimmerCount();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const paymentHandledRef = useRef(false);
  const pageRef = useRef(0);

  const profileCurrency = useMemo(() => {
    if (!profile?.country?.trim()) return "";
    return getCurrencyForCountry(profile.country).code;
  }, [profile?.country]);

  useEffect(() => {
    if (user && profileCurrency) {
      setSelectedCurrency(profileCurrency);
    }
  }, [user, profileCurrency]);

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

  const fetchProducts = useCallback(
    async (reset = true) => {
      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const currentPage = reset ? 0 : pageRef.current + 1;

        const params: Record<string, string | number> = {
          page: currentPage,
          limit: PAGE_SIZE,
          sort: mapSortToApi(sortBy),
        };

        if (selectedCategory) params.category = selectedCategory;
        if (selectedCountry) params.country = selectedCountry;
        if (debouncedSearch) params.search = debouncedSearch;

        const res = await apiClient.get<{ data: Product[]; hasMore?: boolean }>(
          "/api/marketplace",
          params
        );

        const nextProducts = res.data || [];

        setProducts((prev) => (reset ? nextProducts : [...prev, ...nextProducts]));
        pageRef.current = currentPage;
        setHasMore(Boolean(res.hasMore));
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      selectedCategory,
      selectedCurrency,
      selectedCountry,
      debouncedSearch,
      sortBy,
    ]
  );

  useEffect(() => {
    fetchProducts(true);
  }, [selectedCategory, selectedCurrency, selectedCountry, debouncedSearch, sortBy]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchProducts(false);
        }
      },
      { rootMargin: "200px" }
    );

    const node = loadMoreRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
    };
  }, [hasMore, loading, loadingMore, fetchProducts]);

  const handleViewProduct = (productId: string) => {
    router.push(`/marketplace/${productId}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedCurrency(user && profileCurrency ? profileCurrency : "");
    setSelectedCountry("");
    setSortBy("newest");
  };

  const hasActiveFilters =
    searchTerm ||
    selectedCategory ||
    (!user && selectedCurrency) ||
    selectedCountry ||
    sortBy !== "newest";

  const selectedCountryLabel =
    MARKETPLACE_COUNTRIES.find((c) => c.value === selectedCountry)?.label ||
    "All locations";

  const renderSidebarItem = (
    isActive: boolean,
    onClick: () => void,
    label: string,
    Icon?: React.ComponentType<{ className?: string }>
  ) => (
    <div
      onClick={onClick}
      className={`${MP.navItem} ${
        isActive ? MP.navItemActive : MP.navItemInactive
      }`}
    >
      {Icon && (
        <Icon
          className={`${MP.navIcon} ${
            isActive ? MP.navIconActive : MP.navIconInactive
          }`}
        />
      )}
      <span>{label}</span>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-16 px-4">
      <p className="text-gray-600 mb-2">No products found</p>
      <p className="text-sm text-gray-400 mb-4">
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
        <aside
          className={`${MP.sidebarBrowse} ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="md:hidden flex items-center mb-3 gap-1.5">
            <button onClick={() => setIsSidebarOpen(false)} aria-label="Close filters">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold">Marketplace</span>
          </div>

          <MarketplaceHubNav
            activeHub="browse"
            user={user}
            onCreateListing={goToCreateListing}
          >
            <div className="hidden md:block mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className={MP.searchInput}
                  placeholder="Search Marketplace"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </MarketplaceHubNav>

          <div className="md:hidden mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className={MP.searchInput}
                placeholder="Search Marketplace"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className={MP.sectionDivider} />

          <div className={MP.section}>
            <h3 className={MP.sectionTitle}>Location</h3>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className={MP.selectInput}
            >
              {MARKETPLACE_COUNTRIES.map((country) => (
                <option key={country.value || "all"} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>

          <div className={MP.sectionDivider} />

          <div className={MP.section}>
            <h3 className={MP.sectionTitle}>Categories</h3>
            <ul className={MP.navList}>
              {MARKETPLACE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <li key={category.value || "all"}>
                    {renderSidebarItem(
                      selectedCategory === category.value,
                      () => setSelectedCategory(category.value),
                      category.label,
                      Icon
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={MP.section}>
            <h3 className={MP.sectionTitle}>Currency</h3>
            {user && profileCurrency ? (
              <div className="px-2.5 py-2 bg-[#EEF1F4] rounded-lg text-sm text-gray-700">
                {formatCurrencyDisplay(profileCurrency)}
                <p className="text-xs text-gray-500 mt-0.5">Based on your signup country</p>
              </div>
            ) : (
              <ul className={MP.navList}>
                {MARKETPLACE_CURRENCIES.map((currency) => (
                  <li key={currency.value || "all"}>
                    {renderSidebarItem(
                      selectedCurrency === currency.value,
                      () => setSelectedCurrency(currency.value),
                      currency.label
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full text-sm text-gray-600 hover:text-primary-600 transition py-2"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
          />
        )}

        <main className={MP.mainBrowse}>
          <div className={MP.headerRow}>
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-1.5 rounded-lg bg-gray-100 shrink-0"
                aria-label="Open filters"
              >
                <Filter className="w-4 h-4" />
              </button>
              <h1 className={`${MP.pageTitleLg} truncate`}>
                Today&apos;s picks
              </h1>
            </div>

            <div className={MP.headerActions}>
              {selectedCountry && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                  <MapPin className="w-3 h-3 text-primary-600" />
                  {selectedCountryLabel}
                </span>
              )}

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as MarketplaceSort)}
                  className="appearance-none pl-2.5 pr-7 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  aria-label="Sort products"
                >
                  {MARKETPLACE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {user && (
                <button
                  onClick={goToCreateListing}
                  className="btn-primary hidden sm:flex items-center gap-1.5 text-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Sell
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

              <div ref={loadMoreRef} className="h-8 mt-4">
                {loadingMore && (
                  <p className="text-center text-sm text-gray-400 py-4">
                    Loading more...
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {user && (
        <button
          onClick={goToCreateListing}
          className="sm:hidden fixed bottom-5 right-5 z-20 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 transition-colors"
          aria-label="Create new listing"
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
